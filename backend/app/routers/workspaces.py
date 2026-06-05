import json
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.workspace import Workspace
from ..models.source import Source
from ..schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceDashboardResponse,
)
from ..services.source_service import get_or_create_default_workspace

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(db: Session = Depends(get_db)):
    workspaces = db.query(Workspace).order_by(Workspace.updated_at.desc()).all()
    if not workspaces:
        ws = get_or_create_default_workspace(db)
        return [WorkspaceResponse.model_validate(ws)]
    return [WorkspaceResponse.model_validate(w) for w in workspaces]


@router.post("", response_model=WorkspaceResponse)
def create_workspace(payload: WorkspaceCreate, db: Session = Depends(get_db)):
    workspace = Workspace(name=payload.name, description=payload.description or "{}")
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str, payload: WorkspaceUpdate, db: Session = Depends(get_db)
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    if payload.name:
        workspace.name = payload.name
    if payload.description is not None:
        workspace.description = payload.description
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.get("/{workspace_id}/dashboard", response_model=WorkspaceDashboardResponse)
def get_workspace_dashboard(workspace_id: str, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    recent_sources = (
        db.query(Source)
        .filter(Source.workspace_id == workspace_id)
        .order_by(Source.created_at.desc())
        .limit(5)
        .all()
    )

    all_sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
    topic_counter: Counter = Counter()
    for s in all_sources:
        if s.key_topics:
            topic_counter.update(s.key_topics)

    knowledge_growth = []
    for s in sorted(all_sources, key=lambda x: x.created_at):
        knowledge_growth.append({
            "date": s.created_at.isoformat() if s.created_at else "",
            "entities": s.entity_count,
            "relationships": s.relationship_count,
            "source_name": s.source_name,
        })

    graph_data = {}
    try:
        if workspace.description and workspace.description.startswith("{"):
            graph_data = json.loads(workspace.description).get("graph", {})
    except json.JSONDecodeError:
        pass

    return WorkspaceDashboardResponse(
        workspace=WorkspaceResponse.model_validate(workspace),
        recent_sources=[
            {
                "id": s.id,
                "source_name": s.source_name,
                "source_type": s.source_type,
                "processing_status": s.processing_status,
                "chunk_count": s.chunk_count,
                "entity_count": s.entity_count,
                "created_at": s.created_at.isoformat() if s.created_at else "",
            }
            for s in recent_sources
        ],
        popular_topics=[t for t, _ in topic_counter.most_common(8)],
        knowledge_growth=knowledge_growth,
        recent_conversations=[],
    )


@router.get("/{workspace_id}/graph")
def get_workspace_graph(
    workspace_id: str,
    source_ids: str | None = None,
    db: Session = Depends(get_db),
):
    from ..engines.ingestion.graph_integration import merge_workspace_graph

    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    if source_ids:
        ids = [s.strip() for s in source_ids.split(",") if s.strip()]
        sources = (
            db.query(Source)
            .filter(Source.workspace_id == workspace_id, Source.id.in_(ids))
            .all()
        )
        merged = None
        for s in sources:
            if s.processing_status != "completed":
                continue
            graph = (s.metadata_json or {}).get("graph")
            if graph:
                merged = merge_workspace_graph(merged, graph)
        return merged or {"nodes": [], "edges": []}

    try:
        if workspace.description and workspace.description.startswith("{"):
            data = json.loads(workspace.description)
            graph = data.get("graph", {"nodes": [], "edges": []})
            return graph
    except json.JSONDecodeError:
        pass
    return {"nodes": [], "edges": []}
