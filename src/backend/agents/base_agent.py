import os
import json
import re
import time
import concurrent.futures
from datetime import datetime, timezone

try:
    from groq import Groq
except ImportError:
    Groq = None

# Free, fast models active on Groq LPUs
GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound-mini",
    "qwen/qwen3.8-27b"
]

# Data directory path — works both locally and in Docker
def _find_dir(name: str) -> str:
    """Find a directory by walking up from this file."""
    docker_path = os.path.join("/app", name)
    if os.path.isdir(docker_path):
        return docker_path
    current = os.path.dirname(os.path.abspath(__file__))
    for _ in range(5):
        candidate = os.path.join(current, name)
        if os.path.isdir(candidate):
            return candidate
        current = os.path.dirname(current)
    return os.path.join(os.getcwd(), name)

DATA_DIR = _find_dir("data")
SUBMISSION_DIR = _find_dir("submission")


class BaseAgent:
    """
    Base class for all Amaan agents.
    Exclusively uses Groq LPUs with multi-model parallel racing across free models:
    - openai/gpt-oss-120b
    - openai/gpt-oss-20b
    - groq/compound-mini
    - qwen/qwen3.8-27b
    """

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.client = None
        self.provider = "fallback"
        self.model_name = "groq-parallel-pool"
        self.active_models = GROQ_MODELS

        api_key = os.environ.get("GROQ_API_KEY")
        if api_key and Groq:
            self.provider = "groq"
            self.client = Groq(api_key=api_key)
            custom_models = os.environ.get("GROQ_MODELS")
            if custom_models:
                self.active_models = [m.strip() for m in custom_models.split(",") if m.strip()]

        self.db = None
        try:
            from firebase_admin import firestore
            self.db = firestore.client()
        except Exception:
            try:
                import firebase_admin
                from firebase_admin import credentials
                firebase_admin.initialize_app()
                from firebase_admin import firestore
                self.db = firestore.client()
            except Exception:
                # Firestore unavailable — use file-based trace persistence
                self.db = None

    def _query_model(self, model: str, prompt: str) -> dict:
        """Helper to query a single Groq model and return parsed JSON."""
        response = self.client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            max_tokens=600,
            temperature=0.2,
            timeout=10.0,
        )
        response_text = response.choices[0].message.content or "{}"
        
        # Clean markdown code blocks if wrapped
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```"):
            cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text)
            cleaned_text = re.sub(r"\s*```$", "", cleaned_text)
            
        return json.loads(cleaned_text)

    def call_gemini(self, prompt: str, fallback: dict) -> tuple[dict, bool]:
        """
        Call Groq using parallel multi-model racing.
        Sends prompt to 3-4 models simultaneously and returns the FIRST valid parsed response.
        If all models fail or rate-limit, returns fallback dict.
        """
        if not self.client:
            print(f"[{self.agent_name}] No GROQ_API_KEY configured. Using fallback.")
            return fallback, True

        # Ensure JSON instruction
        if "json" not in prompt.lower():
            prompt += "\n\nYou MUST return your response entirely in valid JSON format."

        t0 = time.time()
        try:
            # Query models in parallel, return the first successful valid response
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.active_models)) as executor:
                future_to_model = {
                    executor.submit(self._query_model, model, prompt): model
                    for model in self.active_models
                }

                for future in concurrent.futures.as_completed(future_to_model):
                    model = future_to_model[future]
                    try:
                        parsed_json = future.result()
                        elapsed = round(time.time() - t0, 2)
                        print(f"[{self.agent_name}] Groq parallel winner: {model} ({elapsed}s)")
                        self.model_name = model
                        return parsed_json, False
                    except Exception as e:
                        print(f"[{self.agent_name}] Groq model {model} attempt failed: {e}. Trying other parallel candidates...")

            print(f"[{self.agent_name}] All Groq candidate models failed. Using fallback.")
            return fallback, True

        except Exception as e:
            print(f"[{self.agent_name}] Groq parallel dispatch failed: {e}. Using fallback.")
            return fallback, True

    def log_trace(
        self,
        trace_id: str,
        input_data: dict,
        reasoning_steps: list[str],
        confidence_score: float,
        decision_made: dict,
        alternative_considered: str | None,
        fallback_triggered: bool
    ) -> dict:
        """
        Logs every agent decision to Firestore agent_traces collection.
        """
        trace = {
            "trace_id": trace_id,
            "agent": self.agent_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "input_data": input_data,
            "reasoning_steps": reasoning_steps,
            "confidence_score": round(confidence_score, 3),
            "decision_made": decision_made,
            "alternative_considered": alternative_considered,
            "fallback_triggered": fallback_triggered
        }

        if self.db:
            try:
                self.db.collection("agent_traces").document(trace_id).set(trace)
            except Exception as e:
                print(f"Warning: Failed to save trace to Firestore: {e}")
                self._save_trace_to_file(trace)
        else:
            self._save_trace_to_file(trace)

        return trace

    def _save_trace_to_file(self, trace: dict):
        """Fallback persistence — save traces to JSON file for export."""
        trace_file = os.path.join(SUBMISSION_DIR, "amaan_agent_traces.json")
        os.makedirs(os.path.dirname(trace_file), exist_ok=True)

        traces = []
        if os.path.exists(trace_file):
            try:
                with open(trace_file, 'r') as f:
                    traces = json.load(f)
            except Exception:
                pass

        traces.append(trace)
        with open(trace_file, 'w') as f:
            json.dump(traces, f, indent=2)