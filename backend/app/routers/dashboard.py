import os

from fastapi import APIRouter, HTTPException

from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine
from ..engines.dashboard.dashboard_engine import build_dashboard_summary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")

DEMO_CONTEXT_GRAPH = {
    "nodes": [
        {"id": "Limits", "display_name": "Limits & Continuity", "prerequisites": []},
        {"id": "Derivatives", "display_name": "Derivatives & Rate of Change", "prerequisites": ["Limits"]},
        {"id": "Chain Rule", "display_name": "The Chain Rule", "prerequisites": ["Derivatives"]},
        {"id": "Integrals", "display_name": "Integrals & Area Under Curve", "prerequisites": ["Limits", "Derivatives"]},
        {
            "id": "Fundamental Theorem",
            "display_name": "Fundamental Theorem of Calculus",
            "prerequisites": ["Integrals", "Chain Rule"],
        },
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


@router.get("/student/{student_id}")
async def get_student_dashboard(student_id: str):
    try:
        cognitive_engine = StudentModelingEngine(data_file=DATA_FILE)
        ensure_demo_student(cognitive_engine)
        if student_id not in cognitive_engine.students:
            raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found.")

        student_profile = cognitive_engine.get_student(student_id)
        db = SessionLocal()
        try:
            recommendation = adaptive_engine.generate_recommendation_from_student_profile(
                db,
                student_profile,
                "Derivatives",
                DEMO_CONTEXT_GRAPH,
            )
            return build_dashboard_summary(
                student_profile,
                DEMO_CONTEXT_GRAPH,
                adaptive_recommendation=recommendation.model_dump(),
            )
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
