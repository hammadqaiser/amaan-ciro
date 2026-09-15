"""
BaseAgent — Foundation class for all 8 Amaan agents.
Provides Groq client (replacing Gemini for dev), Firestore logging, and trace generation.
Every agent inherits this — never duplicate these methods.
"""

import os
import json
import re
from datetime import datetime, timezone

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from groq import Groq
except ImportError:
    Groq = None

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
    Supports Vercel AI Gateway (default), Groq, and Gemini with Firestore logging and trace generation.
    """

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.client = None
        self.provider = "fallback"
        self.model_name = "rule_based_fallback"

        # 1. Primary: Vercel AI Gateway (OpenAI-compatible)
        gateway_key = os.environ.get("AI_GATEWAY_API_KEY") or os.environ.get("VERCEL_AI_GATEWAY_KEY")
        if gateway_key and OpenAI:
            self.provider = "vercel_ai_gateway"
            base_url = os.environ.get("AI_GATEWAY_BASE_URL", "https://ai-gateway.vercel.sh/v1")
            # Default to google/gemini-2.0-flash (fast, JSON-native, hackathon aligned)
            # Can also be meta-llama/llama-3.3-70b-instruct or deepseek/deepseek-chat
            self.model_name = os.environ.get("AI_GATEWAY_MODEL", "google/gemini-2.0-flash")
            self.client = OpenAI(api_key=gateway_key, base_url=base_url)
            self.base_url = base_url

        # 2. Fallback: Groq (if Groq API key is present and Gateway key is not)
        elif os.environ.get("GROQ_API_KEY") and Groq:
            self.provider = "groq"
            self.model_name = "llama-3.3-70b-versatile"
            self.client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

        # 3. Fallback: Direct Gemini API (if Gemini key is present)
        elif os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
            try:
                from google import genai
                self.provider = "gemini"
                self.model_name = "gemini-2.0-flash"
                gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                self.client = genai.Client(api_key=gemini_key)
            except Exception:
                self.client = None
                self.provider = "fallback"

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

    def call_gemini(self, prompt: str, fallback: dict) -> tuple[dict, bool]:
        """
        Call the configured AI Gateway / LLM provider.
        Returns parsed JSON dict + fallback_triggered boolean.
        On any failure or missing configuration, returns fallback dict with fallback_triggered=True.
        """
        if not self.client:
            print(f"[{self.agent_name}] No AI Gateway or LLM key configured. Using fallback.")
            return fallback, True

        # JSON mode requirement
        if "json" not in prompt.lower():
            prompt += "\n\nYou MUST return your response entirely in valid JSON format."

        try:
            if self.provider in ("vercel_ai_gateway", "groq"):
                response = self.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.model_name,
                    response_format={"type": "json_object"},
                    temperature=0.2, # Low temp for deterministic JSON
                    timeout=30.0,
                )
                response_text = response.choices[0].message.content or "{}"

            elif self.provider == "gemini":
                from google.genai import types
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    )
                )
                response_text = response.text or "{}"

            else:
                return fallback, True

            # Clean markdown JSON wraps if present
            cleaned_text = response_text.strip()
            if cleaned_text.startswith("```"):
                cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text)
                cleaned_text = re.sub(r"\s*```$", "", cleaned_text)

            return json.loads(cleaned_text), False

        except Exception as e:
            print(f"[{self.agent_name}] {self.provider} ({self.model_name}) failed: {e}. Using fallback.")
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