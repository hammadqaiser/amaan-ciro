"""
Graph Edges — Conditional routing logic for the CIRO LangGraph.

Implements dual-mode routing:
  - demo_mode=True → deterministic if/else (sub-15s guaranteed)
  - demo_mode=False → LLM supervisor via Gemini (production)

Modeled after SlashAgents' conditional_logic.py pattern.
"""

import os
import json
import logging

from google import genai
from google.genai import types

from graph.state import CrisisState

logger = logging.getLogger(__name__)

# Max reflection iterations to prevent infinite loops
MAX_REFLECTION_ITERATIONS = 2


class CIROEdges:
    """Conditional routing for the CIRO crisis graph."""

    # ================================================================
    # MAIN ROUTING: After Classification
    # ================================================================

    def route_after_classification(self, state: CrisisState) -> str:
        """
        Route after CrisisClassificationAgent.
        This is the critical branch point in the graph.

        Returns node name: "verification_node" | "severity_prediction_node" | "end_monitoring"
        """
        if state.get("demo_mode") or state.get("api_failed"):
            return self._deterministic_route_classification(state)
        return self._llm_route_classification(state)

    def _deterministic_route_classification(self, state: CrisisState) -> str:
        """
        Bypass LLM — pure if/else for demo reliability.
        Guarantees sub-15-second response time for judges.
        """
        crisis = state.get("crisis_object", {})
        confidence = crisis.get("confidence_score", 0)
        crisis_type = crisis.get("crisis_type", "unknown")

        if crisis_type == "unknown" or confidence < 0.30:
            logger.info(f"[Edge] Deterministic: unknown/low confidence ({confidence}) → monitoring")
            return "end_monitoring"

        if confidence < 0.50:
            logger.info(f"[Edge] Deterministic: low confidence ({confidence}) → verification")
            return "verification_node"

        logger.info(f"[Edge] Deterministic: confidence {confidence} → severity prediction")
        return "severity_prediction_node"

    def _llm_route_classification(self, state: CrisisState) -> str:
        """
        Use Groq LPUs to decide next step (production mode).
        Falls back to deterministic if LLM fails.
        """
        try:
            crisis = state.get("crisis_object", {})
            groq_key = os.environ.get("GROQ_API_KEY")

            prompt = f"""You are a crisis routing supervisor. Given this classification output,
decide the next step in the pipeline.

Classification result:
- Crisis type: {crisis.get('crisis_type', 'unknown')}
- Confidence: {crisis.get('confidence_score', 0)}
- Contradictions detected: {crisis.get('contradictions_detected', False)}
- Status: {crisis.get('status', 'unknown')}

Rules:
- If confidence < 0.30 or type is "unknown": return "end_monitoring"
- If confidence < 0.50 OR contradictions detected: return "verification_node"
- If confidence >= 0.50 and no major contradictions: return "severity_prediction_node"

Return ONLY this JSON: {{"next_node": "string"}}"""

            response_text = ""
            if groq_key:
                from groq import Groq
                client = Groq(api_key=groq_key)
                for model in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"]:
                    try:
                        response = client.chat.completions.create(
                            messages=[{"role": "user", "content": prompt}],
                            model=model,
                            max_tokens=200,
                            temperature=0.1,
                            timeout=5.0,
                        )
                        response_text = response.choices[0].message.content or ""
                        if response_text:
                            break
                    except Exception:
                        continue
            else:
                return self._deterministic_route_classification(state)

            result = json.loads(response_text)
            next_node = result.get("next_node", "severity_prediction_node")

            valid_nodes = {"verification_node", "severity_prediction_node", "end_monitoring"}
            if next_node in valid_nodes:
                logger.info(f"[Edge] LLM Supervisor decided: {next_node}")
                return next_node

            logger.warning(f"[Edge] LLM returned invalid node: {next_node}. Using deterministic.")
            return self._deterministic_route_classification(state)


        except Exception as e:
            logger.warning(f"[Edge] LLM Supervisor failed: {e}. Using deterministic fallback.")
            return self._deterministic_route_classification(state)

    # ================================================================
    # ROUTING: After Verification (Reflection Loop)
    # ================================================================

    def route_after_verification(self, state: CrisisState) -> str:
        """
        After verification: continue, retract, or loop back for reflection.

        Reflection loop: Classification ⇄ Verification (max 2 iterations).
        """
        verification = state.get("verification_output", {})
        debate = state.get("verification_debate", {})
        verdict = verification.get("verdict", "confirmed")
        iteration = debate.get("iteration_count", 0)

        # Retraction → pipeline ends
        if verdict == "retracted":
            logger.info("[Edge] Crisis retracted → END")
            return "end_retracted"

        # If not resolved and under max iterations → reflect back to classification
        if not debate.get("resolved", True) and iteration < MAX_REFLECTION_ITERATIONS:
            if verdict in ("updated", "escalated"):
                logger.info(f"[Edge] Reflection loop iteration {iteration} → re-classify")
                return "classification_node"

        # Resolved or max iterations reached → continue pipeline
        logger.info(f"[Edge] Verification resolved → severity prediction")
        return "severity_prediction_node"

    # ================================================================
    # ROUTING: Check for empty signals (after ingestion)
    # ================================================================

    def route_after_ingestion(self, state: CrisisState) -> str:
        """Skip classification if no signals were ingested."""
        signals = state.get("raw_signals", [])
        if not signals:
            logger.info("[Edge] No signals ingested → idle")
            return "end_idle"
        return "classification_node"
