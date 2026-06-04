from fastapi import APIRouter, Header, HTTPException

from ..config import settings
from ..engines.adaptive import adaptive_engine, schemas
from ..engines.adaptive.database import SessionLocal
from ..engines.adaptive.seed_data import seed_demo_data


router = APIRouter(prefix="/api/adaptive", tags=["adaptive"])


@router.get("/demo-recommendation")
async def demo_recommendation(x_adaptive_api_key: str | None = Header(default=None)):
    """
    Frontend demo endpoint for the Adaptive Learning Engine.

    It seeds the MVP biology concepts, records one Active Transport attempt,
    and returns the recommendation that should be displayed in the dashboard.
    """
    if settings.ADAPTIVE_API_KEY and x_adaptive_api_key != settings.ADAPTIVE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid adaptive engine API key.")

    try:
        seed_demo_data()
        db = SessionLocal()
        try:
            attempt = schemas.AttemptInput(
                student_id="demo-student",
                concept_id="active_transport",
                question_id="q-active-1",
                correct=True,
                time_spent=38,
                hint_used=False,
                confidence=4,
                difficulty="medium",
            )
            mastery_record, previous_mastery = adaptive_engine.record_attempt(db, attempt)
            recommendation = adaptive_engine.get_recommendation(
                db,
                student_id="demo-student",
                concept_id="active_transport",
            )

            return {
                "success": True,
                "student_id": recommendation.student_id,
                "concept_id": recommendation.concept_id,
                "concept_name": recommendation.concept_name,
                "previous_mastery": previous_mastery,
                "current_mastery": mastery_record.mastery,
                "forgetting_risk": recommendation.forgetting_risk,
                "next_action": recommendation.next_action,
                "recommended_concept": recommendation.recommended_concept,
                "reason": recommendation.reason,
            }
        finally:
            db.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
