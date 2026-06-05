from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(default="My Knowledge Base", min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    total_sources: int
    total_chunks: int
    total_entities: int
    total_relationships: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkspaceDashboardResponse(BaseModel):
    workspace: WorkspaceResponse
    recent_sources: list
    popular_topics: list[str]
    knowledge_growth: list[dict]
    recent_conversations: list[dict]
