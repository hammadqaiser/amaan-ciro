"""
Amaan CIRO — Crisis Intelligence & Response Orchestrator
FastAPI Backend Application

All 12 API endpoints from DATA_FLOWS.md:
- POST /api/pipeline/run          ← trigger full crisis pipeline
- POST /api/signals/ingest        ← SignalIngestionAgent
- POST /api/classify              ← CrisisClassificationAgent
- POST /api/predict/severity      ← SeverityPredictionAgent
- POST /api/allocate              ← ResourceAllocationAgent
- POST /api/simulate              ← SimulationAgent
- POST /api/notify                ← StakeholderCommsAgent
- POST /api/verify                ← VerificationAgent
- POST /api/chat                  ← ChatAgent
- GET  /api/crises/active         ← Active crises state
- GET  /api/resources             ← Resource inventory
- GET  /api/traces/export         ← Hackathon submission traces
- GET  /api/news/live             ← GDELT live news feed
- POST /api/demo/scenario-a       ← Demo scenario trigger
- POST /api/demo/scenario-b       ← Demo scenario trigger
- POST /api/demo/scenario-c       ← Demo scenario trigger
- GET  /health                    ← Cloud Run health check
"""

import os
import json
import sys
import httpx
from datetime import datetime, timezone
from typing import Optional, List
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Check API key availability ──
groq_api_key = os.environ.get("GROQ_API_KEY")

if groq_api_key:
    from agents.base_agent import GROQ_MODELS
    print(f"[Amaan] Groq LPU API detected (key: ...{groq_api_key[-4:]})")
    print(f"[Amaan] Active parallel models: {', '.join(GROQ_MODELS)}")
else:
    print("[Amaan] WARNING: No GROQ_API_KEY set. Agents will use deterministic fallback mode.")

# ── Imports from our agents/models ──
from orchestrator import AmaanOrchestrator, OrchestratorResponse

# ── LangGraph-based orchestration (v2) ──
try:
    from graph.crisis_graph import CIROCrisisGraph
    _graph_available = True
    print("[Amaan] LangGraph CIROCrisisGraph loaded successfully")
except ImportError as e:
    _graph_available = False
    print(f"[Amaan] LangGraph not available ({e}). Using legacy orchestrator only.")
from agents.signal_ingestion import SignalIngestionAgent
from agents.crisis_classification import CrisisClassificationAgent
from agents.severity_prediction import SeverityPredictionAgent
from agents.resource_allocation import ResourceAllocationAgent
from agents.simulation import SimulationAgent
from agents.stakeholder_comms import StakeholderCommsAgent
from agents.verification import VerificationAgent
from agents.chat_agent import ChatAgent, set_active_crises, set_shelters, set_weather_context
from agents.base_agent import DATA_DIR, SUBMISSION_DIR

from models.schemas import (
    SignalIngestionInput, SignalIngestionOutput,
    CrisisClassificationInput, CrisisClassificationOutput,
    SeverityPredictionInput, SeverityPrediction,
    ResourceAllocationInput, AllocationPlan,
    SimulationInput, SimulationResult,
    StakeholderCommsInput, StakeholderCommsOutput,
    VerificationInput, VerificationOutput,
    ChatInput, ChatOutput,
    ResourceInventory, AllocationConstraints
)

# ── In-memory state store ──
active_crises: list = []
pipeline_history: list = []


# ── Lifespan handler ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    # Load shelters into chat agent context
    try:
        inv_file = os.path.join(DATA_DIR, "resource_inventory.json")
        with open(inv_file, 'r') as f:
            inv = json.load(f)
            set_shelters(inv.get("shelters", []))
    except Exception:
        pass
    print("[Amaan] Backend started successfully")
    yield
    print("[Amaan] Backend shutting down")


# ── FastAPI App ──
app = FastAPI(
    title="Amaan",
    description="Crisis Intelligence & Response Orchestrator — Pakistan's AI-Powered Crisis Response System",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS Middleware ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for hackathon demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════
# REQUEST MODELS
# ══════════════════════════════════════

class PipelineRequest(BaseModel):
    location: dict  # {"lat": 33.72, "lng": 73.04, "city": "Islamabad", "sector": "G-10"}
    radius_km: float = 10.0
    time_window_hours: int = 2


class ChatRequest(BaseModel):
    user_message: str
    user_location: dict = {"lat": 33.72, "lng": 73.04}
    language_preference: str = "auto"
    conversation_history: list = []


# ══════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════

@app.get("/health")
async def health_check():
    """Cloud Run health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "system": "Amaan CIRO",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gemini_configured": bool(gemini_api_key or groq_api_key),
        "active_crises": len(active_crises)
    }


# ══════════════════════════════════════
# FULL PIPELINE
# ══════════════════════════════════════

@app.post("/api/pipeline/run", response_model=OrchestratorResponse)
async def run_pipeline(request: PipelineRequest):
    """Trigger the full crisis detection and response pipeline."""
    try:
        orchestrator = AmaanOrchestrator()
        response = await orchestrator.run_pipeline(
            location=request.location,
            radius_km=request.radius_km,
            time_window_hours=request.time_window_hours
        )

        # Update active crises state
        if response.crisis_detected and response.final_output:
            crisis_data = response.final_output.get("crisis", {})
            crisis_data["event_id"] = response.event_id
            active_crises.clear()  # Clear stale crises before adding new
            active_crises.append(crisis_data)
            set_active_crises(active_crises)
            pipeline_history.append({
                "event_id": response.event_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": response.status,
                "crisis_type": crisis_data.get("crisis_type"),
                "agents_executed": response.agents_executed
            })

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@app.post("/api/pipeline/run-v2")
async def run_pipeline_v2(request: PipelineRequest):
    """Run the crisis pipeline using LangGraph-based orchestration (v2)."""
    if not _graph_available:
        raise HTTPException(status_code=501, detail="LangGraph not available. Use /api/pipeline/run instead.")
    try:
        graph = CIROCrisisGraph(demo_mode=False)
        final_state = await graph.run_pipeline(
            location=request.location,
            radius_km=request.radius_km,
            time_window_hours=request.time_window_hours
        )
        response = graph.to_api_response(final_state)

        # Update active crises state
        if response.get("crisis_detected") and response.get("final_output"):
            crisis_data = response["final_output"].get("crisis", {})
            if crisis_data:
                crisis_data["event_id"] = response["event_id"]
                active_crises.clear()  # Clear stale crises before adding new
                active_crises.append(crisis_data)
                set_active_crises(active_crises)

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph pipeline error: {str(e)}")


@app.post("/api/demo/scenario-a-v2")
async def demo_scenario_a_v2():
    """Scenario A via LangGraph — G-10 Islamabad Flooding (demo_mode=True)."""
    if not _graph_available:
        raise HTTPException(status_code=501, detail="LangGraph not available.")
    try:
        graph = CIROCrisisGraph(demo_mode=True)
        final_state = await graph.run_pipeline(
            location={"lat": 33.7047, "lng": 73.0079, "city": "Islamabad",
                      "sector": "G-10", "address": "G-10 Markaz, Islamabad"},
            radius_km=5.0
        )
        return graph.to_api_response(final_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demo graph error: {str(e)}")


# ══════════════════════════════════════
# INDIVIDUAL AGENT ENDPOINTS
# ══════════════════════════════════════

@app.post("/api/signals/ingest", response_model=SignalIngestionOutput)
async def ingest_signals(request: SignalIngestionInput):
    """Run SignalIngestionAgent independently."""
    try:
        agent = SignalIngestionAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/classify", response_model=CrisisClassificationOutput)
async def classify_crisis(request: CrisisClassificationInput):
    """Run CrisisClassificationAgent independently."""
    try:
        agent = CrisisClassificationAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predict/severity", response_model=SeverityPrediction)
async def predict_severity(request: SeverityPredictionInput):
    """Run SeverityPredictionAgent independently."""
    try:
        agent = SeverityPredictionAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/allocate", response_model=AllocationPlan)
async def allocate_resources(request: ResourceAllocationInput):
    """Run ResourceAllocationAgent independently."""
    try:
        agent = ResourceAllocationAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulate", response_model=SimulationResult)
async def simulate_response(request: SimulationInput):
    """Run SimulationAgent independently."""
    try:
        agent = SimulationAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notify", response_model=StakeholderCommsOutput)
async def notify_stakeholders(request: StakeholderCommsInput):
    """Run StakeholderCommsAgent independently."""
    try:
        agent = StakeholderCommsAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/verify", response_model=VerificationOutput)
async def verify_crisis(request: VerificationInput):
    """Run VerificationAgent independently."""
    try:
        agent = VerificationAgent()
        return await agent.run(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat", response_model=ChatOutput)
async def chat(request: ChatRequest):
    """Run ChatAgent — citizen-facing multilingual Q&A."""
    try:
        agent = ChatAgent()
        chat_input = ChatInput(
            user_message=request.user_message,
            user_location=request.user_location,
            language_preference=request.language_preference,
            conversation_history=request.conversation_history
        )
        return await agent.run(chat_input)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════
# STATE ENDPOINTS
# ══════════════════════════════════════

@app.get("/api/crises/active")
async def get_active_crises():
    """Return all currently active crises."""
    return {
        "crises": active_crises,
        "total": len(active_crises),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/resources")
async def get_resources():
    """Return current resource inventory."""
    try:
        inv_file = os.path.join(DATA_DIR, "resource_inventory.json")
        with open(inv_file, 'r') as f:
            inventory = json.load(f)
        return {
            "inventory": inventory,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/traces/export")
async def export_traces():
    """Export all agent traces for hackathon submission."""
    trace_file = os.path.join(SUBMISSION_DIR, "amaan_agent_traces.json")
    if os.path.exists(trace_file):
        with open(trace_file, 'r') as f:
            traces = json.load(f)
        return {
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
            "system": "Amaan Crisis Intelligence — CIRO Challenge",
            "hackathon": "Google AI Seekho 2026 — Antigravity Hackathon",
            "built_with": "Google Antigravity IDE",
            "runtime_platform": "FastAPI on Google Cloud Run — no Antigravity dependency",
            "total_traces": len(traces),
            "traces": traces,
            "pipeline_history": pipeline_history
        }
    return {
        "export_timestamp": datetime.now(timezone.utc).isoformat(),
        "system": "Amaan Crisis Intelligence — CIRO Challenge",
        "total_traces": 0,
        "traces": [],
        "message": "No traces generated yet. Run the pipeline first."
    }


# ══════════════════════════════════════
# LIVE NEWS FEED (GDELT)
# ══════════════════════════════════════

@app.get("/api/news/live")
async def get_live_news():
    """Fetch latest Pakistan crisis news from GDELT for dashboard newsfeed."""
    try:
        url = (
            "https://api.gdeltproject.org/api/v2/doc/doc"
            "?query=(flood OR disaster OR emergency OR crisis) pakistan"
            "&mode=artlist&maxrecords=20&format=json&timespan=24h"
        )
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()

        articles = data.get("articles", [])
        news_items = []
        for art in articles:
            news_items.append({
                "title": art.get("title", ""),
                "url": art.get("url", ""),
                "domain": art.get("domain", ""),
                "language": art.get("language", ""),
                "seen_date": art.get("seendate", ""),
                "source_country": art.get("sourcecountry", ""),
                "tone": art.get("tone", 0),
            })

        return {
            "news": news_items,
            "total": len(news_items),
            "source": "GDELT Project",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "news": [],
            "total": 0,
            "source": "GDELT Project (unavailable)",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# ══════════════════════════════════════
# DEMO SCENARIO TRIGGERS
# ══════════════════════════════════════

@app.post("/api/demo/scenario-a")
async def demo_scenario_a():
    """Scenario A — G-10 Islamabad Flooding (Primary Demo 2.5 min)."""
    request = PipelineRequest(
        location={
            "lat": 33.7047, "lng": 73.0079,
            "city": "Islamabad", "sector": "G-10",
            "address": "G-10 Markaz, Islamabad"
        },
        radius_km=5.0
    )
    return await run_pipeline(request)


@app.post("/api/demo/scenario-b")
async def demo_scenario_b():
    """Scenario B — False Alarm Recovery (45 sec)."""
    from models.schemas import RawSignal, CrisisObject

    # Create a low-confidence crisis
    orchestrator = AmaanOrchestrator()

    # First run ingestion
    ingestion_input = SignalIngestionInput(
        location={"lat": 33.7047, "lng": 73.0079, "city": "Islamabad", "sector": "G-10"},
        radius_km=5.0,
        time_window_hours=2
    )
    ingestion_output = await orchestrator.ingestion_agent.run(ingestion_input)

    # Create a false alarm signal
    false_alarm_signal = RawSignal(
        signal_id="false-alarm-001",
        source="citizen_app",
        signal_type="field_report",
        content="Confirmed: water main burst at G-10/2, not a flood. Repair crew on site.",
        location={"lat": 33.7047, "lng": 73.0079, "address": "G-10/2"},
        timestamp=datetime.now(timezone.utc).isoformat(),
        credibility_score=0.80,
        staleness_flag=False,
        raw_data={"verified": True, "reporter": "field_team_alpha"}
    )

    # Create the crisis to verify against
    crisis = CrisisObject(
        crisis_id="scenario-b-crisis",
        crisis_type="urban_flood",
        sub_type="flash_flood",
        location={"lat": 33.7047, "lng": 73.0079, "city": "Islamabad", "sector": "G-10"},
        confidence_score=0.55,
        contradictions_detected=True,
        contradiction_detail="Field report suggests water main burst, not flood",
        dominant_signals=["sig-001", "sig-002"],
        dismissed_signals=[],
        status="unverified",
        trace={}
    )

    # Run verification
    verif_input = VerificationInput(
        crisis=crisis,
        new_signals=[false_alarm_signal],
        original_classification_trace={"method": "demo_scenario_b"},
        trigger_mode="immediate"
    )
    verif_output = await orchestrator.verification_agent.run(verif_input)

    retracted_crisis = verif_output.updated_crisis or crisis
    retracted_crisis.status = "retracted"
    retracted_crisis.confidence_score = 0.0

    now = datetime.now(timezone.utc).isoformat()
    comms_messages = [
        {
            "id": "msg-b-1",
            "audience": "ndma",
            "channel": "dashboard",
            "language": "english",
            "subject": "FALSE ALARM CONFIRMED — G-10 ISLAMABAD",
            "body": "STAND-DOWN BRIEFING: False alarm confirmed in sector G-10. Field report verified water main burst, not flash flooding. Stand down command core emergency level.",
            "urgency_level": "info",
            "sent_at": now
        },
        {
            "id": "msg-b-2",
            "audience": "emergency_services",
            "channel": "emergency_api",
            "language": "english",
            "subject": "CANCELLATION DISPATCH — G-10 FLOODING",
            "body": "CANCELLATION DISPATCH: Stand down all Rescue 1122 units dispatched to G-10 Markaz. Diverting to base station. Reclassified as localized infrastructure incident.",
            "urgency_level": "critical",
            "sent_at": now
        },
        {
            "id": "msg-b-3",
            "audience": "hospitals",
            "channel": "healthcare_network",
            "language": "english",
            "subject": "CASUALTY DE-ESCALATION — PIMS HOSPITAL",
            "body": "CASUALTY DE-ESCALATION: PIMS Hospital alert stood down. Cancel standby casualty capacity preparation. Situation normal at sector G-10.",
            "urgency_level": "warning",
            "sent_at": now
        },
        {
            "id": "msg-b-4",
            "audience": "public",
            "channel": "fcm_push",
            "language": "bilingual",
            "subject": "ہنگامی الرٹ منسوخ — جی-۱۰ اسلام آباد / EMERGENCY ALERT CANCELLED — G-10 ISLAMABAD",
            "body": (
                "ہنگامی الرٹ منسوخ — جی-۱۰ اسلام آباد\n"
                "جی-۱۰ اسلام آباد میں سیلاب کا خطرہ ٹل گیا ہے۔ ہنگامی الرٹ منسوخ کر دیا گیا ہے اور کسی کو بھی نقل مکانی کرنے کی ضرورت نہیں ہے۔\n\n"
                "EMERGENCY ALERT CANCELLED — G-10 ISLAMABAD\n"
                "The flood risk in G-10 Islamabad has cleared. The emergency alert has been cancelled; no evacuation is required."
            ),
            "urgency_level": "warning",
            "sent_at": now
        },
        {
            "id": "msg-b-5",
            "audience": "media",
            "channel": "infrastructure_alert",
            "language": "english",
            "subject": "PRESS STATEMENT — AMAAN INTELLIGENCE",
            "body": "PRESS STATEMENT: Emergency situation in G-10 Islamabad reclassified as minor municipal water main burst. No public threat. Recovery operations under way.",
            "urgency_level": "warning",
            "sent_at": now
        }
    ]

    simulation_result = {
        "simulation_id": "scenario-b-sim",
        "before_state": {
            "population_at_risk": 0,
            "roads_blocked": [],
            "hospital_capacity_used_pct": 0.0,
            "estimated_casualties_if_unaddressed": 0,
            "response_coverage_pct": 0.0
        },
        "response_actions": [
            {
                "action_type": "stand_down",
                "description": "Recall all dispatched resources and stand down emergency services",
                "estimated_completion_minutes": 5,
                "resources_involved": ["Rescue 1122", "IESCO", "PIMS Hospital"],
                "expected_outcome": "Dispatched assets returned to base, no casualties",
                "side_effects": []
            }
        ],
        "after_state": {
            "population_at_risk": 0,
            "roads_blocked": [],
            "hospital_capacity_used_pct": 0.0,
            "estimated_casualties_if_unaddressed": 0,
            "response_coverage_pct": 100.0
        },
        "metrics": {
            "response_time_improvement_pct": 100.0,
            "population_protected": 0,
            "roads_rerouted": 0,
            "estimated_cost_pkr": 0.0,
            "estimated_lives_protected": 0
        },
        "baseline_comparison": {
            "baseline_response_time_minutes": 23.0,
            "amaan_response_time_minutes": 0.0,
            "baseline_false_positive_rate": 23.0,
            "amaan_false_positive_rate": 0.0,
            "baseline_resource_utilization_pct": 65.0,
            "amaan_resource_utilization_pct": 0.0,
            "improvement_summary": "FALSE ALARM DETECTED IN 0 MINUTES. SAVED UNNECESSARY DISPATCH COST AND HOSPITAL OVERCROWDING."
        }
    }

    # Propagate crisis context to chat agent
    active_crises.clear()
    active_crises.append(retracted_crisis.model_dump())
    set_active_crises(active_crises)

    return {
        "scenario": "B",
        "description": "False Alarm Recovery — Water Main Burst",
        "verification": verif_output.model_dump(),
        "crisis": retracted_crisis.model_dump(),
        "allocation": {
            "plan_id": "scenario-b-plan",
            "crisis_allocations": [],
            "unmet_needs": [],
            "trade_off_explanation": "All dispatched resources stood down due to false alarm verification.",
            "total_resources_deployed": 0,
            "estimated_cost_pkr": 0.0,
            "fairness_check": "Stand down applied uniformly."
        },
        "simulation": simulation_result,
        "comms": {"messages": comms_messages},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/demo/scenario-c")
async def demo_scenario_c():
    """Scenario C — Dual Crisis: G-10 Flood + I-8 Heatwave (30 sec)."""
    from models.schemas import RawSignal, CrisisObject

    orchestrator = AmaanOrchestrator()

    # Create flood crisis
    flood_crisis = CrisisObject(
        crisis_id="flood-g10-001",
        crisis_type="urban_flood",
        sub_type="flash_flood",
        location={"lat": 33.7047, "lng": 73.0079, "city": "Islamabad", "sector": "G-10"},
        confidence_score=0.87,
        contradictions_detected=False,
        contradiction_detail=None,
        dominant_signals=["sig-001", "sig-002", "sig-003"],
        dismissed_signals=["sig-004"],
        status="active",
        trace={}
    )

    # Create heatwave crisis
    heat_crisis = CrisisObject(
        crisis_id="heat-i8-001",
        crisis_type="heatwave",
        sub_type="extreme_heat",
        location={
            "lat": 33.6923, "lng": 73.0612,
            "city": "Islamabad", "sector": "I-8",
            "low_income_flag": True
        },
        confidence_score=0.72,
        contradictions_detected=False,
        contradiction_detail=None,
        dominant_signals=["sig-heat-001", "sig-heat-002"],
        dismissed_signals=[],
        status="active",
        trace={}
    )

    # Severity predictions
    from models.schemas import SeverityPrediction as SevPred
    flood_sev = SevPred(
        severity_level=4, severity_label="Critical",
        affected_radius_km=1.16, affected_population=45000,
        estimated_duration_hours=6.5, peak_impact_time=datetime.now(timezone.utc).isoformat(),
        spread_risk=0.83, cascading_risks=["power_outage", "road_closure"],
        uncertainty_range="±1 hour, ±10% population", trace={}
    )
    heat_sev = SevPred(
        severity_level=2, severity_label="Moderate",
        affected_radius_km=1.1, affected_population=12000,
        estimated_duration_hours=12.0, peak_impact_time=datetime.now(timezone.utc).isoformat(),
        spread_risk=0.45, cascading_risks=["water_shortage"],
        uncertainty_range="±2 hours, ±15% population", trace={}
    )

    # Allocate resources for both crises
    inv_data = orchestrator._load_resource_inventory()
    alloc_input = ResourceAllocationInput(
        crises=[flood_crisis, heat_crisis],
        severity_predictions=[flood_sev, heat_sev],
        resource_inventory=ResourceInventory(**inv_data),
        constraints=AllocationConstraints()
    )
    alloc_output = await orchestrator.allocation_agent.run(alloc_input)

    now = datetime.now(timezone.utc).isoformat()
    comms_messages = [
        {
            "id": "msg-c-1",
            "audience": "ndma",
            "channel": "dashboard",
            "language": "english",
            "subject": "DUAL-CRISIS BRIEFING — URBAN FLOOD (G-10) & HEATWAVE (I-8)",
            "body": "COMMAND BRIEF: Concurrent crises detected. 1. Urban Flooding in G-10 Islamabad (Severity 4/5). 2. Extreme Heatwave in I-8 Islamabad (Severity 2/5). Fairness formula applied: low-income sector I-8 received a 15% priority boost. Resources split: 4 Rescue Teams deployed to G-10, 2 Ambulances and Medical Outreach deployed to I-8.",
            "urgency_level": "critical",
            "sent_at": now
        },
        {
            "id": "msg-c-2",
            "audience": "emergency_services",
            "channel": "emergency_api",
            "language": "english",
            "subject": "DISPATCH DIRECTIVE: CO-ORDINATED DUAL CRISIS DISPATCH",
            "body": "DISPATCH ORDER: 1. Deploy BOAT-01, BOAT-02, TEAM-01, TEAM-02 to G-10 Markaz (Flood rescue). 2. Deploy AMB-01, AMB-02, and Medical Outreach Team to I-8/2 Government School (Heat outreach). Maintain communication vector across both coordinates.",
            "urgency_level": "critical",
            "sent_at": now
        },
        {
            "id": "msg-c-3",
            "audience": "hospitals",
            "channel": "healthcare_network",
            "language": "english",
            "subject": "PIMS HOSPITAL INFLOW WARNING — MULTI-CRISIS TRIAGE",
            "body": "PIMS TRIAGE ALERT: 1. G-10 Flooding casualties expected (estimate 12 trauma beds needed, ETA 15m). 2. I-8 heatstroke patients incoming (estimate 8 hydration units needed, ETA 20m). Triage area separated.",
            "urgency_level": "critical",
            "sent_at": now
        },
        {
            "id": "msg-c-4",
            "audience": "public",
            "channel": "fcm_push",
            "language": "bilingual",
            "subject": "دوہرا ہنگامی الرٹ: سیلاب (جی-۱۰) اور گرمی کی لہر (آئی-۸) / DUAL EMERGENCY ALERT: FLOOD (G-10) & HEATWAVE (I-8)",
            "body": (
                "ہنگامی الرٹ — اسلام آباد\n"
                "1۔ جی-۱۰: شدید بارش سے سیلاب کا خطرہ ہے۔ قریبی شیلٹر جی-۱۰ کمیونٹی سینٹر میں منتقل ہوں۔\n"
                "2۔ آئی-۸: شدید گرمی کی لہر ہے۔ گھروں میں رہیں، پانی زیادہ پیئں اور ہیلپ لائن 1122 پر رابطہ کریں۔\n\n"
                "EMERGENCY ALERT — ISLAMABAD\n"
                "1. G-10: Flash flooding. Evacuate to G-10 Markaz Community Center immediately.\n"
                "2. I-8: Extreme Heatwave. Stay indoors, hydrate frequently, and call 1122 for medical help."
            ),
            "urgency_level": "critical",
            "sent_at": now
        },
        {
            "id": "msg-c-5",
            "audience": "media",
            "channel": "infrastructure_alert",
            "language": "english",
            "subject": "PRESS RELEASE: CONCURRENT EMERGENCIES DECLARED IN ISLAMABAD",
            "body": "OFFICIAL STATEMENT: Amaan CIRO has activated simultaneous emergency protocols for Sector G-10 (urban flood response) and Sector I-8 (heatwave mitigation). Operations are fully coordinated. Citizens are advised to restrict travel on Jinnah Avenue.",
            "urgency_level": "warning",
            "sent_at": now
        }
    ]

    simulation_result = {
        "simulation_id": "scenario-c-sim",
        "before_state": {
            "population_at_risk": 57000,
            "roads_blocked": ["Jinnah Avenue", "G-10 Markaz roads"],
            "hospital_capacity_used_pct": 82.0,
            "estimated_casualties_if_unaddressed": 180,
            "response_coverage_pct": 0.0
        },
        "response_actions": [
            {
                "action_type": "flood_rescue",
                "description": "Deploy rescue boats and teams to flooded streets of G-10",
                "estimated_completion_minutes": 10,
                "resources_involved": ["rescue_boats: 2", "rescue_teams: 4"],
                "expected_outcome": "Evacuation of flooded sectors, residents sheltered",
                "side_effects": []
            },
            {
                "action_type": "heat_mitigation",
                "description": "Deploy medical outreach and hydration tankers to I-8 sector",
                "estimated_completion_minutes": 15,
                "resources_involved": ["medical_outreach_teams: 2", "water_tankers: 2"],
                "expected_outcome": "Heatstroke risk minimized in high-vulnerability sector",
                "side_effects": []
            }
        ],
        "after_state": {
            "population_at_risk": 6500,
            "roads_blocked": ["Jinnah Avenue (partially cleared)"],
            "hospital_capacity_used_pct": 74.0,
            "estimated_casualties_if_unaddressed": 12,
            "response_coverage_pct": 88.0
        },
        "metrics": {
            "response_time_improvement_pct": 57.0,
            "population_protected": 50500,
            "roads_rerouted": 2,
            "estimated_cost_pkr": 384000.0,
            "estimated_lives_protected": 168
        },
        "baseline_comparison": {
            "baseline_response_time_minutes": 23.0,
            "amaan_response_time_minutes": 10.0,
            "baseline_false_positive_rate": 23.0,
            "amaan_false_positive_rate": 6.0,
            "baseline_resource_utilization_pct": 65.0,
            "amaan_resource_utilization_pct": 94.0,
            "improvement_summary": "AMAAN REDUCED RESPONSE TIME BY 57% (23 MIN -> 10 MIN), AND DEPLOYED SPLIT RESOURCES WITH 15% FAIRNESS BONUS FOR I-8 LOW-INCOME FAMILIES."
        }
    }

    # Propagate both crises to chat agent context
    active_crises.clear()
    active_crises.append(flood_crisis.model_dump())
    active_crises.append(heat_crisis.model_dump())
    set_active_crises(active_crises)

    return {
        "scenario": "C",
        "description": "Dual Crisis — G-10 Flood + I-8 Heatwave",
        "crises": [flood_crisis.model_dump(), heat_crisis.model_dump()],
        "crisis": flood_crisis.model_dump(),
        "severities": [flood_sev.model_dump(), heat_sev.model_dump()],
        "allocation": alloc_output.model_dump(),
        "simulation": simulation_result,
        "comms": {"messages": comms_messages},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ══════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
