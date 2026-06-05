from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AttemptInput(BaseModel):
    student_id: str
    concept_id: str
    question_id: str
    correct: bool
    time_spent: int = Field(..., ge=0)
    hint_used: bool
    confidence: int = Field(..., ge=1, le=5)
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")


class MasterySummary(BaseModel):
    concept_id: str
    concept_name: str
    mastery: float
    forgetting_risk: str
    last_practiced: Optional[datetime]


class Recommendation(BaseModel):
    student_id: str
    concept_id: str
    concept_name: str
    current_mastery: float
    forgetting_risk: str
    next_action: str
    recommended_concept: Optional[str] = None
    reason: str
