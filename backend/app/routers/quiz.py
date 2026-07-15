# API Endpoint - Quiz
# Exposes routes handling simulated student test attempts and diagnostic calculations.

import os
import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine
from ..engines.generative.hint_generator import generate_progressive_hints
from ..engines.generative.learning_materials import generate_flashcards, generate_quiz_questions
from ..models.user import User
from ..schemas.quiz import (
    FlashcardReviewCreate,
    GeneratedQuizAnswer,
    GeneratedQuizHintRequest,
    QuizAttemptCreate,
    QuizGenerateRequest,
    WrittenMaterialGenerateRequest,
)
from ..services import generation_store
from ..services.auth_deps import effective_student_id, get_optional_user
from ..services.source_grounding import source_context_for_concept
from ..services.spaced_repetition import due_flashcard_reviews, record_flashcard_review
from ..services.workspace_graph import graph_has_data, load_workspace_graph
from ..services.student_workspace_data import record_workspace_attempt

router = APIRouter(prefix="/api", tags=["quiz"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")
GENERATED_QUESTIONS: dict[str, dict] = {}


def _artifact_payload(artifact) -> dict:
    return {
        "id": str(artifact.id),
        "workspace_id": artifact.workspace_id,
        "concept_id": artifact.concept_ref,
        "artifact_type": artifact.artifact_type,
        "title": artifact.title,
        "content": artifact.content or {},
        "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
    }


def _clean_source_point(text: str) -> str:
    """Turn noisy PDF extraction text into a readable teaching point."""
    cleaned = re.sub(r"---\s*Page\s+\d+\s*---", " ", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bLECTURE\s+\d+\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bCHAP(?:TER)?\s*[-:]?\s*\d+[^.;:]*", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"SCIENTIFIC COMPUTING\s*\([^)]*\)", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"By\s+[^.]{0,90}?(University|Department|Dhulikhel)", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bKathmandu University\b|\bDepartment of Mathematics\b|\bDhulikhel\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("•", ". ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:;,.")
    return cleaned


def _source_teaching_points(source_context: list[dict], limit: int = 5) -> list[str]:
    """Extract compact, non-header bullets from the retrieved source snippets."""
    points: list[str] = []
    seen: set[str] = set()

    for item in source_context:
        cleaned = _clean_source_point(item.get("snippet", ""))
        if not cleaned:
            continue
        candidates = re.split(r"(?<=[.!?])\s+|;\s+|\n+", cleaned)
        for candidate in candidates:
            point = candidate.strip(" -:;,.")
            if not point:
                continue
            if len(point) < 35:
                continue
            if len(point) > 220:
                point = point[:217].rsplit(" ", 1)[0].strip(" -:;,.") + "..."
            lower = point.lower()
            if "jacobi" in lower and ("gauss-seidal" in lower or "gauss-seidel" in lower):
                point = "Jacobi's method and Gauss-Seidel are common iterative methods for solving systems of linear equations."
                lower = point.lower()
            elif "initial approximation" in lower:
                point = "The method begins with an initial approximation and repeatedly updates the unknown values until the result satisfies a convergence condition."
                lower = point.lower()
            elif "self correcting" in lower:
                point = "Iterative methods are self-correcting because errors made in one step can be reduced through later updates."
                lower = point.lower()
            elif lower.startswith("methods may"):
                point = f"Iterative {point[0].lower()}{point[1:]}"
                lower = point.lower()
            if point.count(":") > 1:
                continue
            if lower.startswith(("of mathematics", "scientific computing", "chapter", "lecture")):
                continue
            if lower.count("numerical linear algebra") > 1:
                continue
            if lower.endswith((" simult", " met", " approx", " chap")):
                continue
            if "ð" in point or "�" in point:
                continue
            if lower in seen:
                continue
            if re.search(r"page\s+\d+|lecture\s+\d+|kathmandu university|department of", lower):
                continue
            seen.add(lower)
            points.append(point if point.endswith((".", "?", "!")) else f"{point}.")
            if len(points) >= limit:
                return points

    return points


def _is_generic_concept_description(description: str) -> bool:
    generic_markers = [
        "core concept covering",
        "extracted from the document text",
        "educational details",
    ]
    lowered = description.lower()
    return any(marker in lowered for marker in generic_markers)


def _plain_concept_description(concept_name: str, description: str, teaching_points: list[str]) -> str:
    if description and not _is_generic_concept_description(description):
        return description

    lowered = concept_name.lower()
    if "iterative" in lowered:
        return (
            "An iterative method solves a problem by starting with an initial guess, "
            "repeating a calculation, and improving the answer step by step until it is accurate enough."
        )
    if "newton" in lowered or "raphson" in lowered:
        return (
            "Newton-Raphson is an iterative technique for approximating roots of nonlinear equations "
            "by repeatedly improving an estimate."
        )
    if "error" in lowered:
        return "This concept explains how numerical answers can differ from exact values and how that difference is measured."
    if teaching_points:
        return teaching_points[0]
    return f"{concept_name} is a concept from the selected sources. Focus on its definition, purpose, conditions, and examples."


def _build_written_material(concept: dict, source_context: list[dict], material_type: str) -> dict:
    """Build a readable source-grounded note or study guide without demo content."""
    concept_name = concept.get("display_name") or concept.get("id") or "Selected concept"
    description = concept.get("description") or f"A core idea related to {concept_name}."
    prerequisites = [
        prereq.replace("_", " ").title() if isinstance(prereq, str) else str(prereq)
        for prereq in (concept.get("prerequisites") or [])
    ]
    evidence = _source_teaching_points(source_context, limit=6)
    description = _plain_concept_description(concept_name, description, evidence)
    sources = sorted({item.get("source_name") for item in source_context if item.get("source_name")})

    if material_type == "notes":
        sections = [
            {
                "heading": "Plain-language meaning",
                "body": f"{concept_name} is best understood as: {description}",
                "bullets": [],
            },
            {
                "heading": "Clean source notes",
                "body": "These points are rewritten from the most relevant source passages without page headers or document noise.",
                "bullets": evidence[:4] or [f"Review the selected source passage and identify where it defines or applies {concept_name}."],
            },
            {
                "heading": "How it connects",
                "body": "Use the knowledge graph to connect this idea with related foundations before moving to harder practice.",
                "bullets": prerequisites or ["No prerequisite was identified in the current knowledge graph."],
            },
            {
                "heading": "Quick recall check",
                "body": f"Close the source and explain {concept_name} in two sentences. Then write one example, formula, or use case from memory.",
                "bullets": [
                    f"What problem does {concept_name} help solve?",
                    f"What is the most important condition or step in {concept_name}?",
                ],
            },
        ]
        title = f"{concept_name} Notes"
    else:
        sections = [
            {
                "heading": "Learning goal",
                "body": f"Understand {concept_name}, explain why it matters, and apply it using the uploaded source material.",
                "bullets": [],
            },
            {
                "heading": "Start here",
                "body": description,
                "bullets": prerequisites or [f"Begin by reading the source section where {concept_name} is introduced."],
            },
            {
                "heading": "Study sequence",
                "body": "Use this order for an active study session instead of reading passively.",
                "bullets": [
                    "Read the plain-language meaning and underline unfamiliar terms.",
                    "Use the clean source notes to write a one-sentence summary.",
                    "Work through one example or application without looking back at the source.",
                    "Generate flashcards for recall, then take a quiz at the right difficulty.",
                ],
            },
            {
                "heading": "Important source points",
                "body": "Use these cleaned points to check whether your understanding matches the document.",
                "bullets": evidence[:4] or [f"No clean source point was available, so review the original passage for {concept_name}."],
            },
            {
                "heading": "Self-check",
                "body": "You are ready to move on when you can answer these without the source.",
                "bullets": [
                    f"What is {concept_name} and why does it matter?",
                    f"What is one correct example of {concept_name}?",
                    "Which related concept or prerequisite is most important here?",
                    "What mistake would a student most likely make with this idea?",
                ],
            },
        ]
        title = f"{concept_name} Study Guide"

    return {"title": title, "sections": sections, "sources": sources}


def _grade_short_answer(question: dict, answer_text: str | None) -> tuple[bool, str]:
    answer = (answer_text or "").lower()
    keywords = [word.lower() for word in question.get("expected_keywords", []) if word]
    if not answer.strip():
        return False, "No written answer was submitted."
    if not keywords:
        return len(answer.split()) >= 8, "The answer was checked for a clear written explanation."

    matched = [keyword for keyword in keywords if keyword.lower() in answer]
    required = max(1, min(3, len(keywords) // 2))
    is_correct = len(matched) >= required
    if is_correct:
        return True, f"Your answer used the key idea(s): {', '.join(matched[:4])}."
    missing = [keyword for keyword in keywords if keyword not in matched]
    return False, f"Try to include source-grounded idea(s) such as: {', '.join(missing[:4])}."


def _record_attempt(payload: QuizAttemptCreate, graph_data: dict | None = None, workspace_id: str | None = None) -> dict:
    engine = StudentModelingEngine(data_file=DATA_FILE)
    if payload.student_id not in engine.students:
        engine.create_student(payload.student_id, "New learner")

    engine.record_attempt(
        payload.student_id,
        payload.topic_name,
        payload.question_id,
        payload.is_correct,
        payload.error_type,
        payload.hints_used,
        payload.time_taken,
        difficulty=payload.difficulty,
    )
    engine.save_data()
    if workspace_id:
        record_workspace_attempt(payload.student_id, workspace_id, payload.question_id)

    student = engine.get_student(payload.student_id)
    adaptive_recommendation = None
    if graph_data and graph_has_data(graph_data):
        adaptive_db = SessionLocal()
        try:
            adaptive_recommendation = adaptive_engine.generate_recommendation_from_student_profile(
                adaptive_db,
                student,
                payload.topic_name,
                graph_data,
            ).model_dump()
        finally:
            adaptive_db.close()

    return {
        "success": True,
        "student": student,
        "recommendation": engine.get_recommendation_signal(payload.student_id, payload.topic_name),
        "adaptive_recommendation": adaptive_recommendation,
        "weak_topics": engine.get_weak_topics(payload.student_id),
        "misconceptions": engine.detect_misconceptions(payload.student_id),
    }

@router.post("/attempt")
async def record_attempt(
    payload: QuizAttemptCreate,
    current_user: User | None = Depends(get_optional_user),
):
    try:
        payload.student_id = effective_student_id(current_user, payload.student_id)
        return _record_attempt(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/generate")
async def generate_quiz(
    payload: QuizGenerateRequest,
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Generate multiple-choice questions from a real workspace knowledge graph."""
    graph_data = load_workspace_graph(app_db, payload.workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="Select processed sources before generating a quiz.")

    try:
        concept = next((node for node in graph_data.get("nodes", []) if node.get("id") == payload.concept_id), None)
        source_context = source_context_for_concept(app_db, payload.workspace_id, concept or {})
        questions = generate_quiz_questions(
            graph_data,
            payload.concept_id,
            source_context,
            question_mode=payload.question_mode,
            difficulty=payload.difficulty,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    user_id = str(current_user.id) if current_user else None
    public_questions = []
    for question in questions:
        question_id = f"generated-{uuid4().hex}"
        stored = {**question, "concept_id": payload.concept_id}
        GENERATED_QUESTIONS[question_id] = stored
        # Persist per user so grading survives restarts and stays isolated.
        generation_store.persist_question(
            app_db, question_id, stored, user_id, payload.workspace_id, payload.concept_id
        )
        public_questions.append({
            "id": question_id,
            "concept_id": payload.concept_id,
            "question_type": question["question_type"],
            "difficulty": question["difficulty"],
            "prompt": question["prompt"],
            "options": question["options"],
            "evidence": question.get("evidence"),
            "source_name": question.get("source_name"),
        })
    generation_store.persist_artifact(
        app_db,
        artifact_type="quiz",
        title="Concept Understanding Quiz",
        content={
            "concept_id": payload.concept_id,
            "question_mode": payload.question_mode,
            "difficulty": payload.difficulty,
            "questions": public_questions,
        },
        user_id=user_id,
        workspace_id=payload.workspace_id,
        concept_ref=payload.concept_id,
    )
    return {
        "concept_id": payload.concept_id,
        "title": "Concept Understanding Quiz",
        "instructions": "Answer every question. Each question checks a different part of the selected concept and its place in the learning graph.",
        "questions": public_questions,
    }


@router.post("/quiz/answer")
async def answer_generated_quiz(
    payload: GeneratedQuizAnswer,
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Grade a generated question and update Student Model plus Adaptive Engine."""
    payload.student_id = effective_student_id(current_user, payload.student_id)
    # Prefer the in-memory cache, fall back to the persisted copy (restart-safe).
    question = GENERATED_QUESTIONS.get(payload.question_id) or generation_store.load_question(
        app_db, payload.question_id
    )
    if not question:
        raise HTTPException(status_code=404, detail="Generated question expired. Generate a new quiz.")

    graph_data = load_workspace_graph(app_db, payload.workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="The workspace graph is unavailable.")

    if question.get("question_type") == "short_answer":
        is_correct, evaluation_note = _grade_short_answer(question, payload.answer_text)
        selected_answer = payload.answer_text or ""
    else:
        if payload.selected_option is None:
            raise HTTPException(status_code=422, detail="selected_option is required for multiple-choice questions.")
        selected_answer = question["options"][payload.selected_option]
        is_correct = selected_answer == question["correct_answer"]
        evaluation_note = "The selected option matches the expected answer." if is_correct else "The selected option does not match the expected answer."

    result = _record_attempt(
        QuizAttemptCreate(
            student_id=payload.student_id,
            topic_name=question["concept_id"],
            question_id=payload.question_id,
            is_correct=is_correct,
            error_type=None if is_correct else "Concept misunderstanding",
            hints_used=payload.hints_used,
            time_taken=payload.time_taken,
            difficulty=payload.difficulty,
        ),
        graph_data,
        payload.workspace_id,
    )
    return {
        **result,
        "is_correct": is_correct,
        "selected_answer": selected_answer,
        "correct_answer": question["correct_answer"],
        "explanation": f"{question['explanation']} {evaluation_note}",
        "evidence": question.get("evidence"),
        "source_name": question.get("source_name"),
    }


@router.post("/quiz/hint")
async def get_generated_quiz_hint(
    payload: GeneratedQuizHintRequest,
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Return the next progressive hint for a generated quiz question."""
    question = GENERATED_QUESTIONS.get(payload.question_id) or generation_store.load_question(
        app_db, payload.question_id
    )
    if not question:
        raise HTTPException(status_code=404, detail="Generated question expired. Generate a new quiz.")

    graph_data = load_workspace_graph(app_db, payload.workspace_id)
    concept = next(
        (node for node in graph_data.get("nodes", []) if node.get("id") == question.get("concept_id")),
        None,
    )
    concept_name = (concept or {}).get("display_name") or question.get("concept_id")
    hints = generate_progressive_hints(
        question,
        concept_name=concept_name,
        student_answer=payload.student_answer,
    )
    selected_hint = hints[payload.hint_level - 1]

    return {
        "question_id": payload.question_id,
        "hint_level": payload.hint_level,
        "max_hint_level": len(hints),
        "hint": selected_hint,
        "hints_used": payload.hint_level,
    }


@router.get("/flashcards")
async def get_flashcards(
    workspace_id: str = Query(...),
    concept_id: str = Query(...),
    count: int = Query(default=4, ge=1, le=10),
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Generate revision cards from a selected workspace concept."""
    graph_data = load_workspace_graph(app_db, workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="Select processed sources before generating flashcards.")
    try:
        concept = next((node for node in graph_data.get("nodes", []) if node.get("id") == concept_id), None)
        source_context = source_context_for_concept(app_db, workspace_id, concept or {})
        cards = generate_flashcards(graph_data, concept_id, count, source_context)
        # Save the generation per user so it persists and stays isolated.
        generation_store.persist_flashcards(
            app_db, cards, str(current_user.id) if current_user else None, workspace_id, concept_id
        )
        generation_store.persist_artifact(
            app_db,
            artifact_type="flashcards",
            title=f"{(concept or {}).get('display_name') or concept_id} Flashcards",
            content={"cards": cards},
            user_id=str(current_user.id) if current_user else None,
            workspace_id=workspace_id,
            concept_ref=concept_id,
        )
        return {"concept_id": concept_id, "cards": cards}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/flashcards/review")
async def review_flashcard(
    payload: FlashcardReviewCreate,
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Record flashcard quality, schedule the next review, and update recall mastery."""
    payload.student_id = effective_student_id(current_user, payload.student_id)
    try:
        review = record_flashcard_review(
            payload.student_id,
            payload.workspace_id,
            payload.concept_id,
            payload.card_id,
            payload.rating,
        )
        graph_data = load_workspace_graph(app_db, payload.workspace_id)
        is_correct = payload.rating in {"good", "easy"}
        recall_attempt = _record_attempt(
            QuizAttemptCreate(
                student_id=payload.student_id,
                topic_name=payload.concept_id,
                question_id=f"flashcard-{payload.card_id}",
                is_correct=is_correct,
                error_type=None if is_correct else "Recall gap",
                hints_used=0 if payload.rating in {"easy", "good"} else 1,
                time_taken=20,
                difficulty="Hard" if payload.rating == "easy" else "Medium",
            ),
            graph_data,
            payload.workspace_id,
        )
        return {
            **review,
            "mastery": recall_attempt["student"]["topics"].get(payload.concept_id),
            "adaptive_recommendation": recall_attempt.get("adaptive_recommendation"),
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/flashcards/due")
async def get_due_flashcards(
    student_id: str = Query(...),
    workspace_id: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
):
    student_id = effective_student_id(current_user, student_id)
    return {"student_id": student_id, "due_reviews": due_flashcard_reviews(student_id, workspace_id)}


@router.post("/generate/material")
async def generate_written_material(
    payload: WrittenMaterialGenerateRequest,
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    graph_data = load_workspace_graph(app_db, payload.workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="Select processed sources before generating learning materials.")
    concept = next(
        (node for node in graph_data.get("nodes", []) if node.get("id") == payload.concept_id),
        None,
    )
    if not concept:
        raise HTTPException(status_code=404, detail="The selected concept is not in this workspace graph.")
    source_context = source_context_for_concept(app_db, payload.workspace_id, concept, limit=5)
    material = _build_written_material(concept, source_context, payload.material_type)
    artifact = generation_store.persist_artifact(
        app_db,
        artifact_type=payload.material_type,
        title=material["title"],
        content=material,
        user_id=str(current_user.id) if current_user else None,
        workspace_id=payload.workspace_id,
        concept_ref=payload.concept_id,
    )
    return _artifact_payload(artifact)


@router.get("/generate/history")
async def get_generation_history(
    workspace_id: str = Query(...),
    limit: int = Query(default=50, ge=1, le=100),
    app_db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    artifacts = generation_store.list_artifacts(
        app_db,
        workspace_id=workspace_id,
        user_id=str(current_user.id) if current_user else None,
        limit=limit,
    )
    return {"workspace_id": workspace_id, "artifacts": [_artifact_payload(item) for item in artifacts]}
