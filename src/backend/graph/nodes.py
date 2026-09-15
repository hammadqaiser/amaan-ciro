"""
Graph Nodes — Wraps existing CIRO agents as LangGraph node functions.

Each node:
1. Reads its inputs from CrisisState
2. Calls the existing agent's .run() method (agents stay UNCHANGED)
3. Merges outputs back into CrisisState

This is the bridge layer between LangGraph and the existing agent classes.
"""

import os
import json
import logging
from datetime import datetime, timezone

from graph.state import CrisisState

# Import existing agents (unchanged)
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
    VerificationInput, AllocationConstraints, ResourceInventory,
    RawSignal, CrisisObject, SeverityPrediction as SevPredModel, AllocationPlan,
    SimulationResult,
)

logger = logging.getLogger(__name__)

# Singleton agent instances (created once, reused)
_ingestion = SignalIngestionAgent()
_classification = CrisisClassificationAgent()
_severity = SeverityPredictionAgent()
_allocation = ResourceAllocationAgent()
_simulation = SimulationAgent()
_comms = StakeholderCommsAgent()
_verification = VerificationAgent()


# ============================================================================
# HELPER: Load vulnerability data
# ============================================================================

def _load_vulnerability_data(location: dict) -> dict:
    """Load ICT vulnerability data for the given sector."""
    try:
        vuln_file = os.path.join(DATA_DIR, "ict_vulnerability.json")
        with open(vuln_file, 'r') as f:
            all_data = json.load(f)
        sector = location.get("sector", "")
        if sector and sector in all_data:
            return all_data[sector]
        for key in all_data:
            if key in location.get("address", "") or key in location.get("city", ""):
                return all_data[key]
        return all_data.get("G-10", {})
    except Exception:
        return {"flood_vulnerability": 0.7, "drainage_capacity_mm_per_hr": 15,
                "population_density_per_sqkm": 7000, "area_sqkm": 4.0}


def _load_resource_inventory() -> dict:
    """Load resource inventory from data file."""
    try:
        inv_file = os.path.join(DATA_DIR, "resource_inventory.json")
        with open(inv_file, 'r') as f:
            return json.load(f)
    except Exception:
        return {"ambulances": {"total": 10, "available": 8, "locations": []},
                "rescue_boats": {"total": 5, "available": 4, "locations": []},
                "rescue_teams": {"total": 8, "available": 6, "locations": []},
                "police_traffic_units": {"total": 10, "available": 7, "locations": []},
                "medical_outreach_teams": {"total": 4, "available": 3, "locations": []},
                "water_tankers": {"total": 5, "available": 5, "locations": []},
                "generators": {"total": 8, "available": 6, "locations": []},
                "shelters": []}


# ============================================================================
# NODE 1: Signal Ingestion
# ============================================================================

async def signal_ingestion_node(state: CrisisState) -> dict:
    """Wrap SignalIngestionAgent as a graph node."""
    logger.info("[Node] Signal Ingestion starting...")
    
    demo_mode_set = False
    if state.get("demo_mode"):
        os.environ["DEMO_MODE"] = "1"
        os.environ["DEMO"] = "1"
        demo_mode_set = True
        logger.info("[Node] Signal Ingestion: Enabling DEMO_MODE environment variable.")

    input_data = SignalIngestionInput(
        location=state["location"],
        radius_km=state.get("radius_km", 10.0),
        time_window_hours=state.get("time_window_hours", 2),
    )
    
    try:
        output = await _ingestion.run(input_data)
    finally:
        if demo_mode_set:
            os.environ.pop("DEMO_MODE", None)
            os.environ.pop("DEMO", None)
            logger.info("[Node] Signal Ingestion: Disabled DEMO_MODE environment variable.")

    # Extract weather data from signals for later use
    weather_data = {"rainfall_mm": 60, "temp_c": 30, "rainfall_intensity_mm_per_hr": 20}
    for sig in output.signals:
        if sig.signal_type == "weather" and sig.raw_data:
            weather_data = {
                "rainfall_mm": sig.raw_data.get("rainfall_3h_mm", 60),
                "temp_c": sig.raw_data.get("temperature_c", 30),
                "rainfall_intensity_mm_per_hr": sig.raw_data.get("precipitation_now_mm", 20),
            }
            break

    return {
        "raw_signals": [s.model_dump() for s in output.signals],
        "ingestion_sources_contacted": output.sources_contacted,
        "ingestion_sources_failed": output.sources_failed,
        "ingestion_fallback_used": output.fallback_used,
        "ingestion_trace": output.trace,
        "weather_data": weather_data,
        "vulnerability_data": _load_vulnerability_data(state["location"]),
        "api_failed": state.get("api_failed", False) or output.fallback_used,
        "agents_executed": state.get("agents_executed", []) + ["SignalIngestionAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Ingested {output.total_signals} signals from "
            f"{len(output.sources_contacted)} sources. "
            f"Failed: {output.sources_failed}. Fallback: {output.fallback_used}"
        ],
    }


# ============================================================================
# NODE 2: Crisis Classification
# ============================================================================

async def classification_node(state: CrisisState) -> dict:
    """Wrap CrisisClassificationAgent as a graph node."""
    logger.info("[Node] Crisis Classification starting...")

    # Reconstruct RawSignal objects from state dicts
    signals = [RawSignal(**s) for s in state.get("raw_signals", [])]

    # If reflection loop sent a critique, inject it into historical_context
    debate = state.get("verification_debate", {})
    historical_context = state.get("vulnerability_data", {})
    if debate.get("critique"):
        historical_context = {
            **historical_context,
            "_verification_critique": debate["critique"],
            "_reflection_iteration": debate.get("iteration_count", 0),
        }

    input_data = CrisisClassificationInput(
        signals=signals,
        location=state["location"],
        historical_context=historical_context,
    )
    output = await _classification.run(input_data)

    primary = output.primary_crisis
    return {
        "crisis_object": primary.model_dump(),
        "secondary_crisis": output.secondary_crisis.model_dump() if output.secondary_crisis else None,
        "classification_method": output.classification_method,
        "classification_trace": output.trace,
        "agents_executed": state.get("agents_executed", []) + ["CrisisClassificationAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Classified: {primary.crisis_type}/{primary.sub_type} "
            f"(confidence: {primary.confidence_score:.2f}, "
            f"contradictions: {primary.contradictions_detected})"
        ],
    }


# ============================================================================
# NODE 3: Severity Prediction
# ============================================================================

async def severity_node(state: CrisisState) -> dict:
    """Wrap SeverityPredictionAgent as a graph node."""
    logger.info("[Node] Severity Prediction starting...")
    crisis = CrisisObject(**state["crisis_object"])
    input_data = SeverityPredictionInput(
        crisis=crisis,
        weather_data=state.get("weather_data", {}),
        vulnerability_data=state.get("vulnerability_data", {}),
        historical_events=[],
    )
    output = await _severity.run(input_data)
    return {
        "severity_prediction": output.model_dump(),
        "severity_trace": output.trace,
        "agents_executed": state.get("agents_executed", []) + ["SeverityPredictionAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Severity: Level {output.severity_level} ({output.severity_label}), "
            f"{output.affected_population:,} affected, "
            f"duration {output.estimated_duration_hours:.1f}hrs"
        ],
    }


# ============================================================================
# NODE 4: Resource Allocation
# ============================================================================

async def allocation_node(state: CrisisState) -> dict:
    """Wrap ResourceAllocationAgent as a graph node."""
    logger.info("[Node] Resource Allocation starting...")
    crises = [CrisisObject(**state["crisis_object"])]
    severities = [SevPredModel(**state["severity_prediction"])]

    # Add secondary crisis if present (Scenario C)
    if state.get("secondary_crisis"):
        crises.append(CrisisObject(**state["secondary_crisis"]))
        # Use same severity for secondary if no separate prediction
        severities.append(severities[0])

    inv_data = _load_resource_inventory()
    input_data = ResourceAllocationInput(
        crises=crises,
        severity_predictions=severities,
        resource_inventory=ResourceInventory(**inv_data),
        constraints=AllocationConstraints(),
    )
    output = await _allocation.run(input_data)
    return {
        "allocation_plan": output.model_dump(),
        "allocation_trace": output.trace,
        "agents_executed": state.get("agents_executed", []) + ["ResourceAllocationAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Resources: {output.total_resources_deployed} deployed, "
            f"cost PKR {output.estimated_cost_pkr:,.0f}, unmet: {len(output.unmet_needs)}"
        ],
    }


# ============================================================================
# NODE 5: Simulation
# ============================================================================

async def simulation_node(state: CrisisState) -> dict:
    """Wrap SimulationAgent as a graph node."""
    logger.info("[Node] Simulation starting...")
    input_data = SimulationInput(
        crisis=CrisisObject(**state["crisis_object"]),
        severity=SevPredModel(**state["severity_prediction"]),
        allocation=AllocationPlan(**state["allocation_plan"]),
    )
    output = await _simulation.run(input_data)
    return {
        "simulation_result": output.model_dump(),
        "simulation_trace": output.trace,
        "agents_executed": state.get("agents_executed", []) + ["SimulationAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Simulation: {output.metrics.estimated_lives_protected} lives protected, "
            f"response time improved by {output.metrics.response_time_improvement_pct:.0f}%"
        ],
    }


# ============================================================================
# NODE 6: Stakeholder Communications
# ============================================================================

async def comms_node(state: CrisisState) -> dict:
    """Wrap StakeholderCommsAgent as a graph node."""
    logger.info("[Node] Stakeholder Comms starting...")
    input_data = StakeholderCommsInput(
        crisis=CrisisObject(**state["crisis_object"]),
        severity=SevPredModel(**state["severity_prediction"]),
        allocation=AllocationPlan(**state["allocation_plan"]),
        simulation=SimulationResult(**state["simulation_result"]),
    )
    output = await _comms.run(input_data)
    return {
        "comms_output": output.model_dump(),
        "comms_trace": output.trace,
        "pipeline_status": "completed",
        "agents_executed": state.get("agents_executed", []) + ["StakeholderCommsAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Comms: {len(output.messages)} stakeholder messages sent"
        ],
    }


# ============================================================================
# NODE 7: Verification
# ============================================================================

async def verification_node(state: CrisisState) -> dict:
    """Wrap VerificationAgent as a graph node. Includes reflection logic."""
    logger.info("[Node] Verification starting...")
    crisis = CrisisObject(**state["crisis_object"])
    signals = [RawSignal(**s) for s in state.get("raw_signals", [])]

    input_data = VerificationInput(
        crisis=crisis,
        new_signals=signals,
        original_classification_trace=state.get("classification_trace", {}),
        trigger_mode="immediate",
    )
    output = await _verification.run(input_data)

    # Update reflection debate state
    debate = state.get("verification_debate", {
        "classification_history": "", "verification_history": "",
        "critique": "", "iteration_count": 0, "resolved": False
    })

    new_debate = {**debate, "iteration_count": debate.get("iteration_count", 0) + 1}

    if output.verdict == "retracted":
        new_debate["resolved"] = True
    elif output.verdict == "confirmed":
        new_debate["resolved"] = True
    else:
        # Generate critique for re-classification
        new_debate["critique"] = (
            f"Verification found issues: {output.retraction_reason or 'low confidence'}. "
            f"Confidence delta: {output.confidence_delta}. "
            f"Verdict: {output.verdict}. Re-evaluate with this evidence."
        )
        new_debate["verification_history"] += f"\nIteration {new_debate['iteration_count']}: {output.verdict}"

    # If verification updated the crisis, use the updated version
    updated_crisis = state["crisis_object"]
    if output.updated_crisis:
        updated_crisis = output.updated_crisis.model_dump()

    result = {
        "verification_output": output.model_dump(),
        "verification_trace": output.trace,
        "verification_debate": new_debate,
        "crisis_object": updated_crisis,
        "agents_executed": state.get("agents_executed", []) + ["VerificationAgent"],
        "trace_summary": state.get("trace_summary", []) + [
            f"Verification: verdict={output.verdict}, delta={output.confidence_delta}"
        ],
    }

    if output.verdict == "retracted":
        result["pipeline_status"] = "retracted"

    return result
