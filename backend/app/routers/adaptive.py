import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import settings
from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine
from ..database import get_db
from ..services.workspace_graph import graph_has_data, load_workspace_graph


router = APIRouter(prefix="/api/adaptive", tags=["adaptive"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")

@router.get("/recommendation/{student_id}")
async def get_recommendation(
    student_id: str,
    concept_id: str = Query(..., description="Concept selected from the workspace knowledge graph."),
    workspace_id: str = Query(..., description="Workspace containing the uploaded learning sources."),
    x_adaptive_api_key: str | None = Header(default=None),
    app_db: Session = Depends(get_db),
):
    """
    Build a recommendation from one learner's real quiz history and Context
    Engine knowledge graph.
    """
    if settings.ADAPTIVE_API_KEY and x_adaptive_api_key != settings.ADAPTIVE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid adaptive engine API key.")

    try:
        cognitive_engine = StudentModelingEngine(data_file=DATA_FILE)
        if student_id not in cognitive_engine.students:
            raise HTTPException(status_code=404, detail=f"Student '{student_id}' has no recorded quiz attempts yet.")

        student_profile = cognitive_engine.get_student(student_id)
        graph_data = load_workspace_graph(app_db, workspace_id)
        if not graph_has_data(graph_data):
            raise HTTPException(status_code=409, detail="Upload and process learning sources before requesting a recommendation.")

        graph_concepts = {node.get("id") for node in graph_data.get("nodes", []) if isinstance(node, dict)}
        if concept_id not in graph_concepts:
            raise HTTPException(status_code=422, detail="Concept is not part of the selected workspace graph.")

        db = SessionLocal()
        try:
            recommendation = adaptive_engine.generate_recommendation_from_student_profile(
                db,
                student_profile,
                concept_id,
                graph_data,
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
                "readiness_score": recommendation.readiness_score,
                "suggested_activity": recommendation.suggested_activity,
                "weakest_prerequisite": recommendation.weakest_prerequisite,
                "prerequisite_source": recommendation.prerequisite_source,
                "mastery_source": "Cognitive Student Model mastery_score",
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
