# Pydantic schemas - Quiz attempts validation
# Defines structures verifying quiz performance payloads recorded by the student engine.

from pydantic import BaseModel, Field
from typing import Optional

class QuizAttemptCreate(BaseModel):
    student_id: str
    topic_name: str
    question_id: str
    is_correct: bool
    error_type: Optional[str] = None
    hints_used: int = 0
    time_taken: int = 45


class QuizGenerateRequest(BaseModel):
    workspace_id: str
    concept_id: str


class GeneratedQuizAnswer(BaseModel):
    student_id: str
    workspace_id: str
    question_id: str
    selected_option: int = Field(ge=0, le=3)
    hints_used: int = Field(default=0, ge=0, le=5)
    time_taken: int = Field(default=45, ge=1, le=900)
