# Pydantic schemas - Knowledge Graph validation
# Defines structures verifying nodes, edges, and graph layouts during API calls.

from pydantic import BaseModel
from typing import List, Optional

class GraphNode(BaseModel):
    id: str
    display_name: str
    description: str
    difficulty: int
    prerequisites: List[str]

class GraphEdge(BaseModel):
    from_node: str  # maps to Vis.js 'from'
    to_node: str    # maps to Vis.js 'to'

class KnowledgeGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
