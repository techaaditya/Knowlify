import json
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine
from ..engines.dashboard.dashboard_engine import build_dashboard_summary
from ..models.source import Source
from ..models.workspace import Workspace

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


def ensure_student(engine: StudentModelingEngine, student_id: str):
    if student_id in engine.students:
        return

    engine.create_student(student_id, "Alex Johnson" if student_id == "S001" else student_id)
    engine.save_data()


def graph_has_data(graph_data: dict | None) -> bool:
    return bool(graph_data and (graph_data.get("nodes") or graph_data.get("edges")))


def load_workspace_graph(db: Session, workspace_id: str | None) -> dict:
    if not workspace_id:
        return {}

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    try:
        if workspace.description and workspace.description.startswith("{"):
            graph = json.loads(workspace.description).get("graph", {})
            if graph_has_data(graph):
                return graph
    except json.JSONDecodeError:
        pass

    merged = None
    from ..engines.ingestion.graph_integration import merge_workspace_graph

    sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
    for source in sources:
        if source.processing_status != "completed":
            continue
        graph = (source.metadata_json or {}).get("graph")
        if graph_has_data(graph):
            merged = merge_workspace_graph(merged, graph)

    return merged or {}


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


@router.get("/student/{student_id}")
async def get_student_dashboard(
    student_id: str,
    workspace_id: str | None = Query(default=None),
    app_db: Session = Depends(get_db),
):
    try:
        cognitive_engine = StudentModelingEngine(data_file=DATA_FILE)
        ensure_student(cognitive_engine, student_id)
        if student_id not in cognitive_engine.students:
            raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found.")

        student_profile = cognitive_engine.get_student(student_id)
        context_graph = load_workspace_graph(app_db, workspace_id)
        graph_data = context_graph if graph_has_data(context_graph) else DEMO_CONTEXT_GRAPH
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
            )
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
