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
    difficulty: str = Field(default="Medium", pattern="^(Easy|Medium|Hard|easy|medium|hard)$")


class QuizGenerateRequest(BaseModel):
    workspace_id: str
    concept_id: str
    question_mode: str = Field(default="mixed", pattern="^(mixed|mcq|short_answer)$")
    difficulty: str = Field(default="Medium", pattern="^(Easy|Medium|Hard|easy|medium|hard)$")


class GeneratedQuizAnswer(BaseModel):
    student_id: str
    workspace_id: str
    question_id: str
    selected_option: Optional[int] = Field(default=None, ge=0, le=3)
    answer_text: Optional[str] = None
    hints_used: int = Field(default=0, ge=0, le=5)
    time_taken: int = Field(default=45, ge=1, le=900)
    difficulty: str = Field(default="Medium", pattern="^(Easy|Medium|Hard|easy|medium|hard)$")


class GeneratedQuizHintRequest(BaseModel):
    workspace_id: str
    question_id: str
    hint_level: int = Field(default=1, ge=1, le=3)
    student_answer: Optional[str] = None


class FlashcardReviewCreate(BaseModel):
    student_id: str
    workspace_id: str
    concept_id: str
    card_id: str
    rating: str = Field(pattern="^(again|hard|good|easy)$")


class WrittenMaterialGenerateRequest(BaseModel):
    workspace_id: str
    concept_id: str
    material_type: str = Field(pattern="^(notes|study_guide)$")
