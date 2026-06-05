from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class SourceCreatePaste(BaseModel):
    workspace_id: str
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)


class SourceCreateWebsite(BaseModel):
    workspace_id: str
    url: str = Field(..., min_length=1)


class SourceCreateYouTube(BaseModel):
    workspace_id: str
    url: str = Field(..., min_length=1)


class SourceUpdate(BaseModel):
    source_name: Optional[str] = Field(None, min_length=1, max_length=500)


class ProcessingLogResponse(BaseModel):
    id: str
    stage: str
    status: str
    message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SourceChunkResponse(BaseModel):
    id: str
    chunk_index: int
    text: str
    page_number: Optional[int]
    char_count: int

    class Config:
        from_attributes = True


class SourceResponse(BaseModel):
    id: str
    workspace_id: str
    source_type: str
    source_name: str
    original_location: Optional[str]
    processing_status: str
    processing_stage: Optional[str]
    progress_percent: int
    metadata_json: Optional[dict[str, Any]]
    error_message: Optional[str]
    chunk_count: int
    entity_count: int
    relationship_count: int
    ai_summary: Optional[str]
    key_topics: Optional[list[str]]
    extracted_entities: Optional[list[str]]
    relationship_insights: Optional[list[str]]
    suggested_questions: Optional[list[str]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SourceDetailResponse(SourceResponse):
    extracted_text: Optional[str]
    processing_logs: list[ProcessingLogResponse] = []
    chunks: list[SourceChunkResponse] = []


class SourceStatusResponse(BaseModel):
    id: str
    processing_status: str
    processing_stage: Optional[str]
    progress_percent: int
    error_message: Optional[str]
    processing_logs: list[ProcessingLogResponse] = []

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    sources: list[SourceResponse]
    message: str


class WorkspaceStatsResponse(BaseModel):
    total_sources: int
    total_chunks: int
    total_entities: int
    total_relationships: int
    last_updated: Optional[datetime]
