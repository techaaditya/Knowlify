# Pydantic schemas - Quiz attempts validation
# Defines structures verifying quiz performance payloads recorded by the student engine.

from pydantic import BaseModel
from typing import Optional

class QuizAttemptCreate(BaseModel):
    student_id: str = "S001"
    topic_name: str
    question_id: str
    is_correct: bool
    error_type: Optional[str] = None
    hints_used: int = 0
    time_taken: int = 45
