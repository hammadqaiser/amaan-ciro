"""
AmaanOrchestrator — Chains all agents in the correct sequence.
Not a framework — a plain Python class with explicit logic.
Runs entirely within the FastAPI backend process.

Execution order from DATA_FLOWS.md:
SignalIngestion → Classification → [VerificationAgent if confidence < 0.50]
→ SeverityPrediction → ResourceAllocation → Simulation → StakeholderComms
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List, Dict

from agents.signal_ingestion import SignalIngestionAgent
from agents.crisis_classification import CrisisClassificationAgent
from agents.severity_prediction import SeverityPredictionAgent
from agents.resource_allocation import ResourceAllocationAgent
from agents.simulation import SimulationAgent
from agents.stakeholder_comms import StakeholderCommsAgent
from agents.verification import VerificationAgent
from agents.base_agent import DATA_DIR

from models.schemas import (
    SignalIngestionInput, CrisisClassificationInput, SeverityPredictionInput,
    ResourceAllocationInput, SimulationInput, StakeholderCommsInput,
    VerificationInput, AllocationConstraints, ResourceInventory
)


class OrchestratorResponse(BaseModel):
    """Response model for the full pipeline run."""
    event_id: str
    crisis_detected: bool
    status: str  # "completed" | "retracted" | "degraded" | "idle" | "monitoring"
    trace_summary: List[str]
    agents_executed: List[str]
    total_latency_ms: Optional[float] = None
    final_output: Optional[dict] = None


class AmaanOrchestrator:
    """
    Orchestrator that chains agents in sequence with conditional branching.
    VerificationAgent is triggered when confidence < 0.50.
    """

    def __init__(self):
        self.ingestion_agent = SignalIngestionAgent()
        self.classification_agent = CrisisClassificationAgent()
        self.severity_agent = SeverityPredictionAgent()
        self.allocation_agent = ResourceAllocationAgent()
        self.simulation_agent = SimulationAgent()
        self.comms_agent = StakeholderCommsAgent()
        self.verification_agent = VerificationAgent()

    def _load_vulnerability_data(self, location: dict) -> dict:
        """Load ICT vulnerability data for the given sector."""
        try:
            vuln_file = os.path.join(DATA_DIR, "ict_vulnerability.json")
            with open(vuln_file, 'r') as f:
                all_data = json.load(f)
                sector = location.get("sector", "")
                if sector and sector in all_data:
                    return all_data[sector]
                # Try to match by city or address
                for key in all_data:
                    addr = location.get("address", "")
                    city = location.get("city", "")
                    if key in addr or key in city:
                        return all_data[key]
                return all_data.get("G-10", {})  # Default fallback
        except Exception as e:
            print(f"[Orchestrator] Failed to load vulnerability data: {e}")
            return {}

    def _load_resource_inventory(self) -> dict:
        """Load resource inventory from data file."""
        try:
            inv_file = os.path.join(DATA_DIR, "resource_inventory.json")
            with open(inv_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {
                "ambulances": {"total": 10, "available": 8, "locations": []},
                "rescue_boats": {"total": 5, "available": 4, "locations": []},
                "rescue_teams": {"total": 8, "available": 6, "locations": []},
                "police_traffic_units": {"total": 10, "available": 7, "locations": []},
                "medical_outreach_teams": {"total": 4, "available": 3, "locations": []},
                "water_tankers": {"total": 5, "available": 5, "locations": []},
                "generators": {"total": 8, "available": 6, "locations": []},
                "shelters": []
            }

    async def run_pipeline(
        self,
        location: dict,
        radius_km: float = 10.0,
        time_window_hours: int = 2
    ) -> OrchestratorResponse:
        """Run the full crisis pipeline."""
        event_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        trace_summary = []
        agents_executed = []

        # ── 1. Signal Ingestion ──
        ingestion_input = SignalIngestionInput(
            location=location,
            radius_km=radius_km,
            time_window_hours=time_window_hours
        )
        ingestion_output = await self.ingestion_agent.run(ingestion_input)
        agents_executed.append("SignalIngestionAgent")
        trace_summary.append(
            f"Ingested {ingestion_output.total_signals} signals from "
            f"{len(ingestion_output.sources_contacted)} sources. "
            f"Failed: {ingestion_output.sources_failed}. "
            f"Fallback: {ingestion_output.fallback_used}"
        )

        if ingestion_output.total_signals == 0:
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            return OrchestratorResponse(
                event_id=event_id,
                crisis_detected=False,
                status="idle",
                trace_summary=trace_summary,
                agents_executed=agents_executed,
                total_latency_ms=elapsed
            )

        # ── 2. Crisis Classification ──
        vulnerability_data = self._load_vulnerability_data(location)
        # Inject low_income_flag into location for ResourceAllocationAgent fairness bonus
        if vulnerability_data.get("low_income_flag"):
            location["low_income_flag"] = True
        class_input = CrisisClassificationInput(
            signals=ingestion_output.signals,
            location=location,
            historical_context=vulnerability_data
        )
        class_output = await self.classification_agent.run(class_input)
        agents_executed.append("CrisisClassificationAgent")

        primary = class_output.primary_crisis
        trace_summary.append(
            f"Classified: {primary.crisis_type}/{primary.sub_type} "
            f"(confidence: {primary.confidence_score:.2f}, "
            f"contradictions: {primary.contradictions_detected})"
        )

        # ── 2.5. Verification (if confidence < 0.50) ──
        if primary.confidence_score < 0.50:
            trace_summary.append(
                f"⚠️ Low confidence ({primary.confidence_score:.2f}). "
                f"Triggering VerificationAgent in immediate mode."
            )
            verif_input = VerificationInput(
                crisis=primary,
                new_signals=ingestion_output.signals,
                original_classification_trace=class_output.trace,
                trigger_mode="immediate"
            )
            verif_output = await self.verification_agent.run(verif_input)
            agents_executed.append("VerificationAgent")

            if verif_output.verdict == "retracted":
                trace_summary.append(
                    f"Crisis RETRACTED: {verif_output.retraction_reason}"
                )
                elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                return OrchestratorResponse(
                    event_id=event_id,
                    crisis_detected=False,
                    status="retracted",
                    trace_summary=trace_summary,
                    agents_executed=agents_executed,
                    total_latency_ms=elapsed,
                    final_output={
                        "verification": verif_output.model_dump(),
                        "correction_messages": verif_output.correction_messages
                    }
                )
            elif verif_output.updated_crisis:
                primary = verif_output.updated_crisis
                trace_summary.append(f"Verification result: {verif_output.verdict}")

        if primary.crisis_type in ("unknown", "none", "no_crisis", "normal", "") or primary.confidence_score < 0.30:
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            trace_summary.append("Classification too low confidence or unknown type. Entering monitoring mode.")
            return OrchestratorResponse(
                event_id=event_id,
                crisis_detected=False,
                status="monitoring",
                trace_summary=trace_summary,
                agents_executed=agents_executed,
                total_latency_ms=elapsed
            )

        # ── 3. Severity Prediction ──
        # Extract weather data from ingestion signals
        weather_data = {"rainfall_mm": 60, "temp_c": 30, "rainfall_intensity_mm_per_hr": 20}
        for sig in ingestion_output.signals:
            if sig.signal_type == "weather" and sig.raw_data:
                weather_data = {
                    "rainfall_mm": sig.raw_data.get("rainfall_3h_mm", 60),
                    "temp_c": sig.raw_data.get("temperature_c", 30),
                    "rainfall_intensity_mm_per_hr": sig.raw_data.get("precipitation_now_mm", 20),
                }
                break

        sev_input = SeverityPredictionInput(
            crisis=primary,
            weather_data=weather_data,
            vulnerability_data=vulnerability_data,
            historical_events=[]
        )
        sev_output = await self.severity_agent.run(sev_input)
        agents_executed.append("SeverityPredictionAgent")
        trace_summary.append(
            f"Severity: Level {sev_output.severity_level} ({sev_output.severity_label}), "
            f"{sev_output.affected_population:,} affected, "
            f"duration {sev_output.estimated_duration_hours:.1f}hrs"
        )

        # ── 4. Resource Allocation ──
        inv_data = self._load_resource_inventory()
        alloc_input = ResourceAllocationInput(
            crises=[primary],
            severity_predictions=[sev_output],
            resource_inventory=ResourceInventory(**inv_data),
            constraints=AllocationConstraints()
        )
        alloc_output = await self.allocation_agent.run(alloc_input)
        agents_executed.append("ResourceAllocationAgent")
        trace_summary.append(
            f"Resources: {alloc_output.total_resources_deployed} deployed, "
            f"cost PKR {alloc_output.estimated_cost_pkr:,.0f}, "
            f"unmet: {len(alloc_output.unmet_needs)}"
        )

        # ── 5. Simulation ──
        sim_input = SimulationInput(
            crisis=primary,
            severity=sev_output,
            allocation=alloc_output
        )
        sim_output = await self.simulation_agent.run(sim_input)
        agents_executed.append("SimulationAgent")
        trace_summary.append(
            f"Simulation: {sim_output.metrics.estimated_lives_protected} lives protected, "
            f"response time improved by {sim_output.metrics.response_time_improvement_pct:.0f}%"
        )

        # ── 6. Stakeholder Communications ──
        comms_input = StakeholderCommsInput(
            crisis=primary,
            severity=sev_output,
            allocation=alloc_output,
            simulation=sim_output
        )
        comms_output = await self.comms_agent.run(comms_input)
        agents_executed.append("StakeholderCommsAgent")
        trace_summary.append(f"Comms: {len(comms_output.messages)} stakeholder messages sent")

        # ── Calculate total latency ──
        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        return OrchestratorResponse(
            event_id=event_id,
            crisis_detected=True,
            status="active_response",
            trace_summary=trace_summary,
            agents_executed=agents_executed,
            total_latency_ms=elapsed,
            final_output={
                "crisis": primary.model_dump(),
                "severity": sev_output.model_dump(),
                "allocation": alloc_output.model_dump(),
                "simulation": sim_output.model_dump(),
                "comms": comms_output.model_dump()
            }
        )
