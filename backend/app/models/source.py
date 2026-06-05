import uuid
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


def _uuid():
    return str(uuid.uuid4())


class Source(Base):
    __tablename__ = "sources"

    id = Column(String, primary_key=True, default=_uuid)
    workspace_id = Column(String, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String(50), nullable=False)
    source_name = Column(String(500), nullable=False)
    original_location = Column(Text, nullable=True)
    processing_status = Column(String(30), default="pending")
    processing_stage = Column(String(50), nullable=True)
    progress_percent = Column(Integer, default=0)
    extracted_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True, default=dict)
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    entity_count = Column(Integer, default=0)
    relationship_count = Column(Integer, default=0)
    ai_summary = Column(Text, nullable=True)
    key_topics = Column(JSON, nullable=True, default=list)
    extracted_entities = Column(JSON, nullable=True, default=list)
    relationship_insights = Column(JSON, nullable=True, default=list)
    suggested_questions = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="sources")
    chunks = relationship("SourceChunk", back_populates="source", cascade="all, delete-orphan")
    processing_logs = relationship("ProcessingLog", back_populates="source", cascade="all, delete-orphan")


class SourceChunk(Base):
    __tablename__ = "source_chunks"

    id = Column(String, primary_key=True, default=_uuid)
    source_id = Column(String, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    char_count = Column(Integer, default=0)
    metadata_json = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source = relationship("Source", back_populates="chunks")


class ProcessingLog(Base):
    __tablename__ = "processing_logs"

    id = Column(String, primary_key=True, default=_uuid)
    source_id = Column(String, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source = relationship("Source", back_populates="processing_logs")
