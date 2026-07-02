from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Float
from sqlalchemy.sql import func
from ..database import Base
from .types import GUID, new_uuid


class Document(Base):
    __tablename__ = "documents"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(500), nullable=True)
    filename = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)
    status = Column(String(50), default="pending")  # pending, processing, complete, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    document_id = Column(GUID(), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(500), nullable=False)
    chunk_text = Column(Text, nullable=True)
    page_number = Column(Integer, nullable=True)
    embedding_id = Column(String(255), nullable=True)  # reference into vector store
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ConceptPrerequisite(Base):
    __tablename__ = "concept_prerequisites"

    concept_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
    prerequisite_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
    confidence = Column(Float, default=1.0)
    source = Column(String(50), nullable=True)  # 'llm', 'manual', 'graph'
