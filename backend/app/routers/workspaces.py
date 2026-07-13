import json
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.workspace import Workspace
from ..models.source import Source
from ..models.user import User
from ..schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceDashboardResponse,
)
from ..services.auth_deps import get_current_user
from ..services.source_service import ensure_user_workspaces, workspace_owned_by

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def _owned_or_404(db: Session, workspace_id: str, user: User) -> Workspace:
    workspace = workspace_owned_by(db, workspace_id, str(user.id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return workspace


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    workspaces = ensure_user_workspaces(db, str(user.id))
    return [WorkspaceResponse.model_validate(w) for w in workspaces]


@router.post("", response_model=WorkspaceResponse)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = Workspace(
        name=payload.name,
        description=payload.description or "{}",
        user_id=str(user.id),
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = _owned_or_404(db, workspace_id, user)
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = _owned_or_404(db, workspace_id, user)
    if payload.name:
        workspace.name = payload.name
    if payload.description is not None:
        workspace.description = payload.description
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.get("/{workspace_id}/dashboard", response_model=WorkspaceDashboardResponse)
def get_workspace_dashboard(
    workspace_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = _owned_or_404(db, workspace_id, user)

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
    user: User = Depends(get_current_user),
):
    from ..engines.ingestion.graph_integration import merge_workspace_graph

    workspace = _owned_or_404(db, workspace_id, user)

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

    # First: try to read from the merged workspace description blob
    try:
        if workspace.description and workspace.description.startswith("{"):
            data = json.loads(workspace.description)
            graph = data.get("graph")
            if graph and (graph.get("nodes") or graph.get("edges")):
                return graph
    except json.JSONDecodeError:
        pass

    # Fallback: aggregate graph data directly from each completed source's metadata_json.
    # This handles sources that were processed before the workspace graph-merge logic existed.
    all_sources = (
        db.query(Source)
        .filter(Source.workspace_id == workspace_id, Source.processing_status == "completed")
        .all()
    )
    merged = None
    for s in all_sources:
        graph = (s.metadata_json or {}).get("graph")
        if graph:
            merged = merge_workspace_graph(merged, graph)

    if merged:
        # Persist the merged graph back into workspace.description so future requests are instant
        try:
            existing_desc = {}
            if workspace.description and workspace.description.startswith("{"):
                existing_desc = json.loads(workspace.description)
            existing_desc["graph"] = merged
            workspace.description = json.dumps(existing_desc)
            db.commit()
        except Exception:
            pass
        return merged

    return {"nodes": [], "edges": []}
