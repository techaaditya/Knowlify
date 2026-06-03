# API Endpoint - Chat
# Exposes routes handling Socratic tutoring chat logic.

from fastapi import APIRouter
from pydantic import BaseModel
from ..engines.generative.socratic_tutor import generate_socratic_prompt

router = APIRouter(prefix="/api", tags=["chat"])

class ChatMessage(BaseModel):
    concept: str
    message: str

@router.post("/chat")
async def chat_tutor(payload: ChatMessage):
    prompt = generate_socratic_prompt(payload.concept, payload.message)
    # Simple simulated response for now
    return {
        "reply": f"As a Socratic tutor, I received your query about '{payload.concept}'. What do you think is the first step to analyze this?",
        "prompt_debug": prompt
    }
