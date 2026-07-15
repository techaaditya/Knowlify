# API Endpoint - Adaptive Chat
# Full LLM-powered tutoring grounded in workspace sources, guided by Student Model.

import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..engines.cognitive.student_model import StudentModelingEngine
from ..engines.generative.chat_engine import (
    build_graph_context,
    build_source_context,
    build_student_context,
    generate_fallback_chat_response,
    generate_chat_response,
)
from ..models.source import Source
from ..models.user import User
from ..models.student_profile import ChatMessageModel
from ..services import generation_store
from ..services.auth_deps import effective_student_id, get_current_user, get_optional_user
from ..services.source_grounding import source_context_for_query
from ..services.workspace_graph import graph_has_data, load_workspace_graph

router = APIRouter(prefix="/api", tags=["chat"])


def _save_chat_message(
    db: Session,
    user: User | None,
    workspace_id: str,
    role: str,
    content: str,
    concept_ref: str | None,
    mode: str | None,
) -> None:
    """Persist a single chat turn for the authenticated user (no-op if anon)."""
    if not user or not content:
        return
    db.add(
        ChatMessageModel(
            user_id=str(user.id),
            role=role,
            content=content,
            workspace_id=workspace_id,
            concept_ref=concept_ref,
            msg_mode=mode,
        )
    )
    db.commit()

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ChatHistoryMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    workspace_id: str
    concept_id: Optional[str] = None
    student_id: str = "student-1"
    mode: str = "explain"
    message: str
    history: list[ChatHistoryMessage] = []
    source_ids: list[str] = []
    # When set (from the canvas tool palette), forces one visualization type so
    # the model gets a focused, single-schema prompt instead of the all-types one.
    canvas_type: Optional[str] = None
    persist: bool = True


class ChatAnswerRequest(BaseModel):
    workspace_id: str
    concept_id: str
    student_id: str = "student-1"
    answer: str
    question_context: str = ""
    question_id: Optional[str] = None
    difficulty: str = "Medium"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_chatbot_api_key(x_chatbot_api_key: str | None = Header(default=None)) -> None:
    """Optional local-demo API key gate for chatbot endpoints."""
    if settings.CHATBOT_API_KEY and x_chatbot_api_key != settings.CHATBOT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid chatbot API key.")

def _load_student_data(student_id: str) -> tuple[dict | None, dict | None]:
    """Load the student profile and detect misconceptions."""
    try:
        engine = StudentModelingEngine(data_file=DATA_FILE)
        if student_id in engine.students:
            profile = engine.get_student(student_id)
            misconceptions = engine.detect_misconceptions(student_id)
            return profile, misconceptions
    except Exception:
        pass
    return None, None


def _load_adaptive_recommendation(
    student_id: str,
    concept_id: str,
    graph_data: dict,
) -> dict | None:
    """Try to fetch an adaptive recommendation; return None on any failure."""
    try:
        from ..engines.adaptive import adaptive_engine
        from ..engines.adaptive.database import SessionLocal

        engine = StudentModelingEngine(data_file=DATA_FILE)
        if student_id not in engine.students:
            return None

        student_profile = engine.get_student(student_id)
        graph_concepts = {
            node.get("id")
            for node in graph_data.get("nodes", [])
            if isinstance(node, dict)
        }
        if concept_id not in graph_concepts:
            return None

        db = SessionLocal()
        try:
            rec = adaptive_engine.generate_recommendation_from_student_profile(
                db, student_profile, concept_id, graph_data
            )
            return rec.model_dump()
        finally:
            db.close()
    except Exception:
        return None


def _load_source_details(db: Session, source_ids: list[str]) -> list[dict]:
    """Load full source details including extracted text for grounding."""
    if not source_ids:
        return []
    sources = db.query(Source).filter(Source.id.in_(source_ids)).all()
    return [
        {
            "source_name": s.source_name,
            "ai_summary": s.ai_summary,
            "key_topics": s.key_topics,
            "extracted_text": s.extracted_text or "",
        }
        for s in sources
    ]


def _get_concept_name(graph_data: dict, concept_id: str | None) -> str | None:
    """Look up the display name for a concept ID."""
    if not concept_id or not graph_data:
        return None
    for node in graph_data.get("nodes", []):
        if isinstance(node, dict) and node.get("id") == concept_id:
            return node.get("display_name", concept_id)
    return concept_id


def _get_concept_node(graph_data: dict, concept_id: str | None) -> dict | None:
    if not concept_id or not graph_data:
        return None
    for node in graph_data.get("nodes", []):
        if isinstance(node, dict) and node.get("id") == concept_id:
            return node
    return None


def _build_mastery_info(
    student_profile: dict | None,
    concept_id: str | None,
) -> dict | None:
    """Extract mastery info for the response payload."""
    if not student_profile or not concept_id:
        return None
    topic_data = student_profile.get("topics", {}).get(concept_id)
    if not topic_data:
        return {"mastery_score": 0, "status": "Not Started", "total_attempts": 0}
    return {
        "mastery_score": topic_data.get("mastery_score", 0),
        "status": topic_data.get("status", "Not Started"),
        "total_attempts": topic_data.get("total_attempts", 0),
        "correct_answers": topic_data.get("correct_answers", 0),
        "wrong_answers": topic_data.get("wrong_answers", 0),
    }


def _suggested_actions(
    recommendation: dict | None,
    misconceptions: dict | None,
    concept_id: str | None,
) -> list[dict]:
    """Convert Student Model + Adaptive signals into clickable chat actions."""
    actions = []
    target = concept_id

    if recommendation:
        next_action = recommendation.get("next_action")
        recommended = (
            recommendation.get("recommended_concept")
            or recommendation.get("weakest_prerequisite")
            or concept_id
        )
        if next_action == "prerequisite_review":
            actions.append({
                "label": "Review prerequisite",
                "mode": "explain",
                "target_concept": recommended,
                "message": f"Review the prerequisite {recommended} before we continue.",
            })
            actions.append({
                "label": "Make prerequisite flashcards",
                "mode": "flashcard",
                "target_concept": recommended,
                "message": f"Generate flashcards for the prerequisite {recommended}.",
            })
        elif next_action in {"reteach", "explanation_then_practice"}:
            actions.append({
                "label": "Open explanation",
                "mode": "step_by_step",
                "target_concept": target,
                "message": "Teach this concept step by step and focus on my weak spots.",
            })
        elif next_action in {"harder_practice", "move_forward"}:
            actions.append({
                "label": "Start practice quiz",
                "mode": "test",
                "target_concept": target,
                "message": "Start a practice quiz at the right difficulty for me.",
            })
        elif next_action == "review":
            actions.append({
                "label": "Start quick review",
                "mode": "flashcard",
                "target_concept": target,
                "message": "Create review flashcards for this concept.",
            })

    active_misconceptions = misconceptions.get(concept_id, []) if misconceptions and concept_id else []
    if active_misconceptions:
        actions.append({
            "label": "Fix misconception",
            "mode": "step_by_step",
            "target_concept": target,
            "message": f"Help me fix this misconception: {active_misconceptions[0]}.",
        })

    if not actions:
        actions.append({
            "label": "Generate flashcards",
            "mode": "flashcard",
            "target_concept": target,
            "message": "Generate source-based flashcards for this concept.",
        })
        actions.append({
            "label": "Start practice quiz",
            "mode": "test",
            "target_concept": target,
            "message": "Start a source-based practice quiz.",
        })

    return actions[:4]


def _parse_canvas_scene(raw: str) -> dict | None:
    """Best-effort parse of the canvas-mode LLM reply into a scene dict.

    The model is instructed to return raw JSON, but may still wrap it in
    markdown fences — same tolerant unwrap already used for answer grading.
    Returns None on any failure so the caller can fall back to plain text.
    """
    if not raw:
        return None
    text = raw.strip()
    if "```" in text:
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        scene = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(scene, dict) or "visualization" not in scene:
        return None
    # Well-formed scene with progressive steps — use as-is.
    if isinstance(scene.get("steps"), list) and scene["steps"]:
        return scene
    # Salvage a flattened scene: weaker models sometimes drop the "steps"
    # wrapper and put the payload (e.g. chart "points", graph "nodes") at the
    # top level. Rebuild a single-step scene so it still renders as a diagram
    # instead of dumping raw JSON at the student.
    return _wrap_flat_scene(scene)


# Maps a visualization type to the top-level keys a flattened reply might carry.
_FLAT_PAYLOAD_KEYS: dict[str, tuple[str, ...]] = {
    "graph": ("nodes", "edges", "layout", "directed"),
    "equation": ("latex", "highlightTerms"),
    "comparison": ("columns", "rows"),
    "timeline": ("events",),
    "chart": ("kind", "unit", "points"),
    "plot": ("functions", "xRange", "yRange", "points"),
    "mindmap": ("root", "nodes"),
    "infographic": ("theme", "title", "subtitle", "blocks"),
    "video": ("duration", "background", "elements", "captions"),
}


def _wrap_flat_scene(scene: dict) -> dict | None:
    """Rebuild a one-step scene from a reply that flattened the payload."""
    viz = scene.get("visualization")
    keys = _FLAT_PAYLOAD_KEYS.get(viz)
    if not keys:
        return None
    payload = {k: scene[k] for k in keys if k in scene}
    if not payload:
        return None
    # A payload with no usable data isn't worth rendering.
    if viz == "chart" and not payload.get("points"):
        return None
    if viz == "plot" and not payload.get("functions"):
        return None
    if viz == "mindmap" and not payload.get("nodes"):
        return None
    if viz == "infographic" and not payload.get("blocks"):
        return None
    if viz == "video" and not payload.get("elements"):
        return None
    return {
        "title": scene.get("title") or "Concept",
        "visualization": viz,
        "steps": [{"narration": scene.get("narration") or "", viz: payload}],
    }


def _keyword_grade(answer: str, question: dict | None, concept_name: str | None) -> tuple[bool, str, str | None]:
    """Offline grading fallback for short answers."""
    if not question:
        return False, "Could not evaluate your answer automatically.", "Needs manual review"

    keywords = [str(k).lower() for k in question.get("expected_keywords", []) if str(k).strip()]
    if concept_name:
        keywords.append(concept_name.lower())
    answer_text = answer.lower()
    matched = [keyword for keyword in keywords if keyword and keyword in answer_text]
    needed = 1 if len(keywords) <= 2 else max(2, len(set(keywords)) // 2)
    is_correct = len(set(matched)) >= needed
    if is_correct:
        return True, "Good answer. It includes the key source/concept terms expected for this question.", None
    return (
        False,
        "The answer is missing key terms from the source-grounded question. Review the explanation and try again.",
        "Missing key concept terms",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat")
async def adaptive_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    _auth: None = Depends(_require_chatbot_api_key),
):
    """
    Full adaptive chat flow:
    1. Load workspace graph
    2. Load source details for grounding
    3. Load student profile + misconceptions
    4. Fetch adaptive recommendation (graceful failure)
    5. Build context and call LLM
    6. Return response with metadata + structured quiz/flashcards if requested
    """
    # 1. Load workspace graph
    try:
        graph_data = load_workspace_graph(db, payload.workspace_id)
    except HTTPException:
        graph_data = {"nodes": [], "edges": []}

    # 2. Load source details
    source_ids = payload.source_ids
    if not source_ids:
        # If no specific sources selected, use all completed sources in workspace
        all_sources = (
            db.query(Source)
            .filter(
                Source.workspace_id == payload.workspace_id,
                Source.processing_status == "completed",
            )
            .all()
        )
        source_ids = [s.id for s in all_sources]

    source_details = _load_source_details(db, source_ids)
    source_names = [s["source_name"] for s in source_details if s.get("source_name")]

    # 3. Load student profile (identity comes from the auth token when present)
    student_id = effective_student_id(current_user, payload.student_id)
    student_profile, misconceptions = _load_student_data(student_id)

    # 4. Fetch adaptive recommendation (non-blocking)
    recommendation = None
    if payload.concept_id and graph_has_data(graph_data):
        recommendation = _load_adaptive_recommendation(
            student_id, payload.concept_id, graph_data
        )

    # 5. Build all context layers
    concept_node = _get_concept_node(graph_data, payload.concept_id)
    retrieved_chunks = source_context_for_query(
        db,
        payload.workspace_id,
        payload.message,
        concept_node,
        source_ids=source_ids,
        limit=5,
    )
    source_context = build_source_context(source_details, payload.concept_id, retrieved_chunks)
    graph_context = build_graph_context(graph_data, payload.concept_id)
    student_context = build_student_context(
        student_profile, payload.concept_id, misconceptions, recommendation
    )
    concept_name = _get_concept_name(graph_data, payload.concept_id)

    # 6. Structured quiz/flashcards if requested and concept is selected
    flashcards = None
    quiz = None

    if payload.concept_id and graph_has_data(graph_data):
        if payload.mode == "flashcard":
            try:
                from ..engines.generative.learning_materials import generate_flashcards
                flashcards = generate_flashcards(graph_data, payload.concept_id, count=5, source_context=retrieved_chunks)
                # Save the generated set per user.
                if flashcards:
                    generation_store.persist_flashcards(
                        db, flashcards,
                        str(current_user.id) if current_user else None,
                        payload.workspace_id, payload.concept_id,
                    )
            except Exception as e:
                print(f"[chat] Flashcard generation error: {e}")
        elif payload.mode == "test":
            try:
                from ..engines.generative.learning_materials import generate_quiz_questions
                from uuid import uuid4
                from .quiz import GENERATED_QUESTIONS

                questions = generate_quiz_questions(graph_data, payload.concept_id, retrieved_chunks)
                if questions:
                    # Pick a question randomly or based on history
                    question = questions[0]
                    question_id = f"generated-chat-{uuid4().hex}"
                    stored = {**question, "concept_id": payload.concept_id}
                    GENERATED_QUESTIONS[question_id] = stored
                    # Persist so /chat/answer can grade it after a restart, per user.
                    generation_store.persist_question(
                        db, question_id, stored,
                        str(current_user.id) if current_user else None,
                        payload.workspace_id, payload.concept_id,
                    )
                    quiz = {
                        "id": question_id,
                        "concept_id": payload.concept_id,
                        "prompt": question["prompt"],
                        "options": question["options"],
                    }
            except Exception as e:
                print(f"[chat] Quiz generation error: {e}")

    # 7. Call LLM for conversational tutoring
    try:
        history_dicts = [{"role": m.role, "content": m.content} for m in payload.history]

        reply = generate_chat_response(
            message=payload.message,
            history=history_dicts,
            mode=payload.mode,
            source_context=source_context,
            graph_context=graph_context,
            student_context=student_context,
            concept_name=concept_name,
            canvas_type=payload.canvas_type,
        )
    except Exception as e:
        print(f"[chat] LLM error: {e}")
        reply = generate_fallback_chat_response(
            message=payload.message,
            mode=payload.mode,
            source_context=source_context,
            graph_context=graph_context,
            student_context=student_context,
            concept_name=concept_name,
        )

    # 7b. Canvas mode: the raw reply is scene JSON, not prose — parse it and
    # swap in a short human-readable line for chat history/display, keeping
    # the full structured scene in its own response field.
    canvas_scene = None
    if payload.mode == "canvas":
        canvas_scene = _parse_canvas_scene(reply)
        if not canvas_scene:
            # One repair pass: the keyframe/step JSON is the most error-prone
            # output, so show the model its own bad reply and ask for corrected
            # JSON before giving up and apologising to the student.
            try:
                repair_history = history_dicts + [
                    {"role": "user", "content": payload.message},
                    {"role": "assistant", "content": reply},
                ]
                repaired = generate_chat_response(
                    message=(
                        "That was not a single valid JSON scene object. Return ONLY the "
                        "corrected JSON object for the canvas — no prose, no code fences."
                    ),
                    history=repair_history,
                    mode="canvas",
                    source_context=source_context,
                    graph_context=graph_context,
                    student_context=student_context,
                    concept_name=concept_name,
                    canvas_type=payload.canvas_type,
                )
                canvas_scene = _parse_canvas_scene(repaired)
            except Exception as e:
                print(f"[chat] Canvas repair pass failed: {e}")
        if canvas_scene:
            step_count = len(canvas_scene.get("steps") or [])
            scene_title = canvas_scene.get("title") or concept_name or "this concept"
            reply = f"Here's a visual walkthrough of **{scene_title}** ({step_count} steps) — see the canvas."
        else:
            # The reply wasn't usable scene JSON — never show the student the raw
            # JSON/model output. Give a clean, actionable message instead.
            reply = (
                "I couldn't sketch that one out as a diagram just now. "
                "Try rephrasing (for example, name concrete values like \"y = 2x + 1\") "
                "or ask again — I'll take another pass at it."
            )

    # 8. Persist this turn to the user's per-workspace history.
    if payload.persist:
        _save_chat_message(db, current_user, payload.workspace_id, "user", payload.message, payload.concept_id, payload.mode)
        _save_chat_message(db, current_user, payload.workspace_id, "assistant", reply, payload.concept_id, payload.mode)

    # 9. Build response
    mastery_info = _build_mastery_info(student_profile, payload.concept_id)

    # Detect which sources were likely cited in the response
    ranked_source_names = list(dict.fromkeys(
        chunk.get("source_name") for chunk in retrieved_chunks if chunk.get("source_name")
    ))
    sources_used = [
        name for name in source_names
        if name.lower() in reply.lower() or name.split(".")[0].lower() in reply.lower()
    ]

    return {
        "reply": reply,
        "mode": payload.mode,
        "concept_name": concept_name,
        "sources_used": sources_used if sources_used else ranked_source_names or source_names[:3],
        "mastery": mastery_info,
        "recommendation": recommendation,
        "misconceptions": (
            misconceptions.get(payload.concept_id, [])
            if misconceptions and payload.concept_id
            else []
        ),
        "flashcards": flashcards,
        "quiz": quiz,
        "canvas_scene": canvas_scene,
        "suggested_actions": _suggested_actions(recommendation, misconceptions, payload.concept_id),
    }


@router.post("/chat/answer")
async def grade_chat_answer(
    payload: ChatAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    _auth: None = Depends(_require_chatbot_api_key),
):
    """
    Grade a student's answer from a chat quiz question.
    Records the attempt in the Student Model and returns updated mastery.
    """
    student_id = effective_student_id(current_user, payload.student_id)
    try:
        graph_data = load_workspace_graph(db, payload.workspace_id)
    except HTTPException:
        graph_data = {"nodes": [], "edges": []}

    is_correct = False
    explanation = ""
    error_type = None

    # Try the in-memory cache, then the persisted copy (restart-safe).
    from .quiz import GENERATED_QUESTIONS
    question = None
    if payload.question_id:
        question = GENERATED_QUESTIONS.get(payload.question_id) or generation_store.load_question(
            db, payload.question_id
        )

    if question:
        correct_answer = question["correct_answer"]
        selected_answer = payload.answer.strip()
        options = question["options"]

        if question.get("question_type") == "short_answer":
            is_correct, explanation, error_type = _keyword_grade(
                selected_answer, question, _get_concept_name(graph_data, payload.concept_id)
            )
        else:
            try:
            # Check if answer is a digit index
                if selected_answer.isdigit():
                    idx = int(selected_answer)
                    if 0 <= idx < len(options):
                        is_correct = (options[idx] == correct_answer)
                # Check if answer is a character like A, B, C, D
                elif len(selected_answer) == 1 and selected_answer.upper() in ["A", "B", "C", "D"]:
                    idx = ord(selected_answer.upper()) - 65
                    if 0 <= idx < len(options):
                        is_correct = (options[idx] == correct_answer)
                else:
                    is_correct = (selected_answer.lower() == correct_answer.lower())
            except Exception:
                is_correct = (selected_answer.lower() == correct_answer.lower())

            explanation = question["explanation"]
            error_type = None if is_correct else "Concept misunderstanding"
    else:
        # Fallback to LLM grading
        student_profile, misconceptions = _load_student_data(student_id)
        concept_name = _get_concept_name(graph_data, payload.concept_id)

        eval_prompt = (
            f"The student was asked a question about '{concept_name or payload.concept_id}'. "
            f"Question context: {payload.question_context}\n\n"
            f"Student's answer: {payload.answer}\n\n"
            f"Evaluate: Is the student's answer correct? Respond with a JSON object: "
            f'{{"is_correct": true/false, "explanation": "brief explanation", '
            f'"error_type": null or "type of error if wrong"}}'
        )

        try:
            from ..engines.generative.chat_engine import _get_chat_client

            client = _get_chat_client()
            response = client.chat.completions.create(
                model=settings.CHAT_MODEL,
                messages=[
                    {"role": "system", "content": "You are a grading assistant. Respond ONLY with valid JSON."},
                    {"role": "user", "content": eval_prompt},
                ],
                temperature=0.1,
                max_tokens=300,
            )
            import json

            raw = response.choices[0].message.content or "{}"
            try:
                result = json.loads(raw)
            except json.JSONDecodeError:
                if "```" in raw:
                    json_part = raw.split("```")[1]
                    if json_part.startswith("json"):
                        json_part = json_part[4:]
                    result = json.loads(json_part.strip())
                else:
                    result = {"is_correct": False, "explanation": raw, "error_type": None}

            is_correct = result.get("is_correct", False)
            explanation = result.get("explanation", "")
            error_type = result.get("error_type")

        except Exception as e:
            print(f"[chat/answer] LLM grading error: {e}")
            question = {
                "expected_keywords": [payload.concept_id, *(payload.question_context.split()[:8])],
                "explanation": payload.question_context,
            }
            is_correct, explanation, error_type = _keyword_grade(
                payload.answer, question, concept_name
            )

    # Record the attempt in Student Model
    try:
        engine = StudentModelingEngine(data_file=DATA_FILE)
        if student_id not in engine.students:
            engine.create_student(student_id, "Learner")

        engine.record_attempt(
            student_id=student_id,
            topic_name=payload.concept_id,
            question_id=payload.question_id or f"chat-quiz-{hash(payload.question_context) % 10000}",
            is_correct=is_correct,
            error_type=error_type if not is_correct else None,
            hints_used=0,
            time_taken=0,
            difficulty=payload.difficulty,
        )
        engine.save_data()

        updated_profile = engine.get_student(student_id)
        updated_mastery = _build_mastery_info(updated_profile, payload.concept_id)
    except Exception as e:
        print(f"[chat/answer] Student Model error: {e}")
        updated_mastery = None

    # Fetch updated recommendation
    updated_recommendation = None
    if graph_has_data(graph_data):
        updated_recommendation = _load_adaptive_recommendation(
            student_id, payload.concept_id, graph_data
        )

    return {
        "is_correct": is_correct,
        "explanation": explanation,
        "error_type": error_type,
        "mastery": updated_mastery,
        "recommendation": updated_recommendation,
    }


@router.get("/chat/history")
async def get_chat_history(
    workspace_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's saved chat turns for a workspace."""
    rows = (
        db.query(ChatMessageModel)
        .filter(
            ChatMessageModel.user_id == str(current_user.id),
            ChatMessageModel.workspace_id == workspace_id,
        )
        .order_by(ChatMessageModel.created_at.asc())
        .all()
    )
    return {
        "workspace_id": workspace_id,
        "messages": [
            {
                "id": str(r.id),
                "role": r.role,
                "content": r.content,
                "concept_id": r.concept_ref,
                "mode": r.msg_mode,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.delete("/chat/history")
async def clear_chat_history(
    workspace_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete the authenticated user's chat history for a workspace."""
    db.query(ChatMessageModel).filter(
        ChatMessageModel.user_id == str(current_user.id),
        ChatMessageModel.workspace_id == workspace_id,
    ).delete()
    db.commit()
    return {"message": "Chat history cleared."}
