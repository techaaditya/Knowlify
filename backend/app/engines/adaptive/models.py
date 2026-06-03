from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from .database import Base


concept_prerequisites = Table(
    "adaptive_concept_prerequisites",
    Base.metadata,
    Column("concept_id", String, ForeignKey("adaptive_concepts.id"), primary_key=True),
    Column("prerequisite_id", String, ForeignKey("adaptive_concepts.id"), primary_key=True),
)


class Student(Base):
    __tablename__ = "adaptive_students"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)

    mastery_records = relationship("MasteryRecord", back_populates="student")
    attempts = relationship("Attempt", back_populates="student")


class Concept(Base):
    __tablename__ = "adaptive_concepts"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    prerequisites = relationship(
        "Concept",
        secondary=concept_prerequisites,
        primaryjoin=id == concept_prerequisites.c.concept_id,
        secondaryjoin=id == concept_prerequisites.c.prerequisite_id,
        backref="unlocks",
    )


class MasteryRecord(Base):
    __tablename__ = "adaptive_mastery_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("adaptive_students.id"), nullable=False, index=True)
    concept_id = Column(String, ForeignKey("adaptive_concepts.id"), nullable=False, index=True)
    mastery = Column(Float, nullable=False, default=0.0)
    last_practiced = Column(DateTime(timezone=True), nullable=True)

    student = relationship("Student", back_populates="mastery_records")
    concept = relationship("Concept")


class Attempt(Base):
    __tablename__ = "adaptive_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("adaptive_students.id"), nullable=False, index=True)
    concept_id = Column(String, ForeignKey("adaptive_concepts.id"), nullable=False, index=True)
    question_id = Column(String, nullable=False)
    correct = Column(Boolean, nullable=False)
    time_spent = Column(Integer, nullable=False)
    hint_used = Column(Boolean, nullable=False)
    confidence = Column(Integer, nullable=False)
    difficulty = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="attempts")
    concept = relationship("Concept")
