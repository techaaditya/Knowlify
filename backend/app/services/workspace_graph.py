"""Read the knowledge graph produced from a workspace's uploaded sources."""

import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models.source import Source
from ..models.workspace import Workspace


def graph_has_data(graph_data: dict | None) -> bool:
    """Return True only when Context Engine produced at least one graph item."""
    return bool(graph_data and (graph_data.get("nodes") or graph_data.get("edges")))


def load_workspace_graph(db: Session, workspace_id: str) -> dict:
    """Load a real Context Engine graph; never substitute a demo graph."""
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

    from ..engines.ingestion.graph_integration import merge_workspace_graph

    merged = None
    sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
    for source in sources:
        if source.processing_status != "completed":
            continue
        graph = (source.metadata_json or {}).get("graph")
        if graph_has_data(graph):
            merged = merge_workspace_graph(merged, graph)

    return merged or {"nodes": [], "edges": []}
