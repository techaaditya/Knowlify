import os

from fastapi import APIRouter, Header, HTTPException

from ..config import settings
from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine


router = APIRouter(prefix="/api/adaptive", tags=["adaptive"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")

CALCULUS_GRAPH_DATA = {
    "nodes": [
        {"id": "Limits"},
        {"id": "Derivatives"},
        {"id": "Chain Rule"},
        {"id": "Integrals"},
        {"id": "Fundamental Theorem"},
    ],
    "edges": [
        {"from": "Limits", "to": "Derivatives"},
        {"from": "Derivatives", "to": "Chain Rule"},
        {"from": "Limits", "to": "Integrals"},
        {"from": "Derivatives", "to": "Integrals"},
        {"from": "Integrals", "to": "Fundamental Theorem"},
        {"from": "Chain Rule", "to": "Fundamental Theorem"},
    ],
}


def ensure_demo_student(engine: StudentModelingEngine):
    if "S001" in engine.students:
        return

    engine.create_student("S001", "Alex Johnson")
    engine.record_attempt("S001", "Limits", "Q1", is_correct=True, hints_used=0, time_taken=40)
    engine.record_attempt("S001", "Limits", "Q2", is_correct=True, hints_used=1, time_taken=55)
    engine.record_attempt("S001", "Limits", "Q3", is_correct=False, error_type="Sign error", hints_used=2, time_taken=80)
    engine.record_attempt("S001", "Derivatives", "Q4", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=90)
    engine.record_attempt("S001", "Derivatives", "Q5", is_correct=False, error_type="Formula mistake", hints_used=1, time_taken=85)
    engine.record_attempt("S001", "Derivatives", "Q6", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=95)
    engine.record_attempt("S001", "Derivatives", "Q7", is_correct=True, hints_used=1, time_taken=70)
    engine.save_data()


@router.get("/demo-recommendation")
async def demo_recommendation(x_adaptive_api_key: str | None = Header(default=None)):
    """
    Frontend demo endpoint for the Adaptive Learning Engine.

    It reads mastery from the Cognitive Student Model, syncs that mastery into
    the Adaptive Engine, and returns the recommendation displayed in the dashboard.
    """
    if settings.ADAPTIVE_API_KEY and x_adaptive_api_key != settings.ADAPTIVE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid adaptive engine API key.")

    try:
        cognitive_engine = StudentModelingEngine(data_file=DATA_FILE)
        ensure_demo_student(cognitive_engine)
        student_profile = cognitive_engine.get_student("S001")

        db = SessionLocal()
        try:
            adaptive_engine.sync_from_student_model_and_graph(
                db,
                student_profile,
                CALCULUS_GRAPH_DATA,
            )
            recommendation = adaptive_engine.get_recommendation(
                db,
                student_id="S001",
                concept_id="Derivatives",
                student_profile=student_profile,
            )

            return {
                "success": True,
                "student_id": recommendation.student_id,
                "concept_id": recommendation.concept_id,
                "concept_name": recommendation.concept_name,
                "previous_mastery": recommendation.current_mastery,
                "current_mastery": recommendation.current_mastery,
                "forgetting_risk": recommendation.forgetting_risk,
                "next_action": recommendation.next_action,
                "recommended_concept": recommendation.recommended_concept,
                "reason": recommendation.reason,
                "misconception": recommendation.misconception,
                "mastery_source": "Cognitive Student Model mastery_score",
            }
        finally:
            db.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
