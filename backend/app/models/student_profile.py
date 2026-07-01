import json
from sqlalchemy import (
    Column, String, DateTime, Text, Integer, ForeignKey,
    Float, Boolean, UniqueConstraint, JSON,
)
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator, TEXT
from ..database import Base
from .types import GUID, new_uuid


# ---------------------------------------------------------------------------
# Dialect-safe text-array column (Postgres ARRAY ↔ SQLite JSON-in-TEXT)
# ---------------------------------------------------------------------------
class SafeTextArray(TypeDecorator):
    """
    Stores a list of strings.
    - PostgreSQL: native TEXT[] array
    - SQLite: JSON-encoded TEXT
    """
    impl = TEXT
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import ARRAY
            return dialect.type_descriptor(ARRAY(String))
        return dialect.type_descriptor(TEXT)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        if dialect.name == "postgresql":
            return value
        try:
            return json.loads(value)
        except Exception:
            return []


# ---------------------------------------------------------------------------
# Topic Mastery  (SM-2 spaced-repetition attributes)
# ---------------------------------------------------------------------------
class TopicMastery(Base):
    __tablename__ = "topic_mastery"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    concept_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=True)
    mastery_score = Column(Float, default=0.0)
    attempts = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    easiness_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=1)
    repetition_count = Column(Integer, default=0)
    last_reviewed = Column(DateTime(timezone=True), nullable=True)
    next_review = Column(DateTime(timezone=True), nullable=True)
    misconceptions = Column(SafeTextArray, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "concept_id", name="uq_user_concept_mastery"),
    )


# ---------------------------------------------------------------------------
# Quiz Attempts
# ---------------------------------------------------------------------------
class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    concept_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=True)
    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    quality_score = Column(Integer, nullable=True)  # SM-2 quality (0-5)
    misconception_tag = Column(String(255), nullable=True)
    time_taken_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Interaction Events (analytics)
# ---------------------------------------------------------------------------
class InteractionEvent(Base):
    __tablename__ = "interaction_events"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    concept_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=True)
    event_type = Column(String(100), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    event_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Flashcards
# ---------------------------------------------------------------------------
class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    concept_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Chat Messages (persistent history)
# ---------------------------------------------------------------------------
class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    role = Column(String(50), nullable=True)  # 'user' or 'assistant'
    content = Column(Text, nullable=True)
    context_concept_id = Column(GUID(), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
