import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine
from ..engines.dashboard.dashboard_engine import build_dashboard_summary
from ..services.workspace_graph import graph_has_data, load_workspace_graph
from ..services.student_workspace_data import filter_profile_for_workspace
from ..services.source_grounding import workspace_source_summary
from ..services.spaced_repetition import due_flashcard_reviews
from ..models.workspace import Workspace

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")

def empty_student_profile(student_id: str) -> dict:
    """Represent a new learner without writing any artificial attempts."""
    return {
        "student_id": student_id,
        "name": "New learner",
        "topics": {},
        "attempt_history": [],
    }


def choose_recommendation_concept(student_profile: dict, graph_data: dict) -> str | None:
    topics = student_profile.get("topics", {})
    graph_concepts = [
        node.get("id")
        for node in graph_data.get("nodes", [])
        if isinstance(node, dict) and node.get("id")
    ]

    practiced_graph_concepts = [concept for concept in graph_concepts if concept in topics]
    if practiced_graph_concepts:
        return min(
            practiced_graph_concepts,
            key=lambda concept: topics[concept].get("mastery_score", 0),
        )

    if topics:
        return min(topics, key=lambda concept: topics[concept].get("mastery_score", 0))

    if graph_concepts:
        return graph_concepts[0]

    return None


def load_all_workspace_graphs(db: Session) -> dict:
    """Merge every real workspace graph for the learner's overall analysis."""
    from ..engines.ingestion.graph_integration import merge_workspace_graph

    merged = None
    for workspace in db.query(Workspace).all():
        graph = load_workspace_graph(db, workspace.id)
        if graph_has_data(graph):
            merged = merge_workspace_graph(merged, graph)
    return merged or {"nodes": [], "edges": []}


@router.get("/student/{student_id}")
async def get_student_dashboard(
    student_id: str,
    workspace_id: str | None = Query(default=None, description="Workspace for focused analysis."),
    scope: str = Query(default="workspace", pattern="^(workspace|overall)$"),
    app_db: Session = Depends(get_db),
):
    try:
        cognitive_engine = StudentModelingEngine(data_file=DATA_FILE)
        student_profile = (
            cognitive_engine.get_student(student_id)
            if student_id in cognitive_engine.students
            else empty_student_profile(student_id)
        )
        if scope == "workspace":
            if not workspace_id:
                raise HTTPException(status_code=422, detail="workspace_id is required for workspace analysis.")
            context_graph = load_workspace_graph(app_db, workspace_id)
            student_profile = filter_profile_for_workspace(student_profile, workspace_id, context_graph)
            source_summary = workspace_source_summary(app_db, workspace_id)
            due_reviews = due_flashcard_reviews(student_id, workspace_id)
        else:
            context_graph = load_all_workspace_graphs(app_db)
            source_summary = {
                "workspace_count": app_db.query(Workspace).count(),
                "mode": "overall",
            }
            due_reviews = due_flashcard_reviews(student_id)
        graph_data = context_graph if graph_has_data(context_graph) else {"nodes": [], "edges": []}
        concept_id = choose_recommendation_concept(student_profile, graph_data)

        db = SessionLocal()
        try:
            recommendation = None
            if concept_id:
                recommendation = adaptive_engine.generate_recommendation_from_student_profile(
                    db,
                    student_profile,
                    concept_id,
                    graph_data,
                )
            return build_dashboard_summary(
                student_profile,
                graph_data,
                adaptive_recommendation=recommendation.model_dump() if recommendation else None,
                due_flashcards=due_reviews,
                source_summary=source_summary,
            )
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
