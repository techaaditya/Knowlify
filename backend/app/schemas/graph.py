# Pydantic schemas - Knowledge Graph validation
# Defines structures verifying nodes, edges, and graph layouts during API calls.

from pydantic import BaseModel, Field, ConfigDict
from typing import List

class GraphNode(BaseModel):
    id: str
    display_name: str
    description: str
    difficulty: int
    prerequisites: List[str]

class GraphEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str = Field(alias="to")

class KnowledgeGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
