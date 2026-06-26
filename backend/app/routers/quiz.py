# API Endpoint - Quiz
# Exposes routes handling simulated student test attempts and diagnostic calculations.

import os
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..engines.adaptive import adaptive_engine
from ..engines.adaptive.database import SessionLocal
from ..engines.cognitive.student_model import StudentModelingEngine
from ..engines.generative.learning_materials import generate_flashcards, generate_quiz_questions
from ..schemas.quiz import GeneratedQuizAnswer, QuizAttemptCreate, QuizGenerateRequest
from ..services.workspace_graph import graph_has_data, load_workspace_graph

router = APIRouter(prefix="/api", tags=["quiz"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")
GENERATED_QUESTIONS: dict[str, dict] = {}


def _record_attempt(payload: QuizAttemptCreate, graph_data: dict | None = None) -> dict:
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
    )
    engine.save_data()

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
async def record_attempt(payload: QuizAttemptCreate):
    try:
        return _record_attempt(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/generate")
async def generate_quiz(payload: QuizGenerateRequest, app_db: Session = Depends(get_db)):
    """Generate multiple-choice questions from a real workspace knowledge graph."""
    graph_data = load_workspace_graph(app_db, payload.workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="Select processed sources before generating a quiz.")

    try:
        questions = generate_quiz_questions(graph_data, payload.concept_id, payload.count)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    public_questions = []
    for question in questions:
        question_id = f"generated-{uuid4().hex}"
        GENERATED_QUESTIONS[question_id] = {**question, "concept_id": payload.concept_id}
        public_questions.append({
            "id": question_id,
            "concept_id": payload.concept_id,
            "prompt": question["prompt"],
            "options": question["options"],
        })
    return {"concept_id": payload.concept_id, "questions": public_questions}


@router.post("/quiz/answer")
async def answer_generated_quiz(
    payload: GeneratedQuizAnswer,
    app_db: Session = Depends(get_db),
):
    """Grade a generated question and update Student Model plus Adaptive Engine."""
    question = GENERATED_QUESTIONS.get(payload.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Generated question expired. Generate a new quiz.")

    graph_data = load_workspace_graph(app_db, payload.workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="The workspace graph is unavailable.")

    selected_answer = question["options"][payload.selected_option]
    is_correct = selected_answer == question["correct_answer"]
    result = _record_attempt(
        QuizAttemptCreate(
            student_id=payload.student_id,
            topic_name=question["concept_id"],
            question_id=payload.question_id,
            is_correct=is_correct,
            error_type=None if is_correct else "Concept misunderstanding",
            hints_used=payload.hints_used,
            time_taken=payload.time_taken,
        ),
        graph_data,
    )
    return {
        **result,
        "is_correct": is_correct,
        "correct_answer": question["correct_answer"],
        "explanation": question["explanation"],
    }


@router.get("/flashcards")
async def get_flashcards(
    workspace_id: str = Query(...),
    concept_id: str = Query(...),
    count: int = Query(default=4, ge=1, le=10),
    app_db: Session = Depends(get_db),
):
    """Generate revision cards from a selected workspace concept."""
    graph_data = load_workspace_graph(app_db, workspace_id)
    if not graph_has_data(graph_data):
        raise HTTPException(status_code=409, detail="Select processed sources before generating flashcards.")
    try:
        return {"concept_id": concept_id, "cards": generate_flashcards(graph_data, concept_id, count)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
