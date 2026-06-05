import uuid
from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base


def _uuid():
    return str(uuid.uuid4())


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False, default="My Knowledge Base")
    description = Column(Text, nullable=True)
    total_sources = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    total_entities = Column(Integer, default=0)
    total_relationships = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sources = relationship("Source", back_populates="workspace", cascade="all, delete-orphan")
