# API Endpoint - Chat
# Exposes routes handling Socratic tutoring chat logic.

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from ..engines.generative.socratic_tutor import generate_socratic_prompt

router = APIRouter(prefix="/api", tags=["chat"])

class SourceContext(BaseModel):
    id: str
    name: str
    summary: Optional[str] = None
    topics: list[str] = []


class ChatMessage(BaseModel):
    concept: str
    message: str
    sources: list[SourceContext] = []


@router.post("/chat")
async def chat_tutor(payload: ChatMessage):
    prompt = generate_socratic_prompt(payload.concept, payload.message)

    source_hint = ""
    if payload.sources:
        names = ", ".join(s.name for s in payload.sources[:5])
        source_hint = f" Based on your selected sources ({names}),"

    if payload.message.strip().endswith("?"):
        reply = (
            f"That's a thoughtful question about '{payload.concept}'.{source_hint} "
            f"What evidence from your sources supports your thinking so far?"
        )
    else:
        reply = (
            f"Interesting point about '{payload.concept}'.{source_hint} "
            f"Can you explain why that matters in the broader context of your knowledge base?"
        )

    return {"reply": reply, "prompt_debug": prompt}
