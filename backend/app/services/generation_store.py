"""
Persistence for AI-generated learning materials (quizzes + flashcards).

Generated quiz questions were previously held only in an in-memory dict, so
grading broke on restart and was shared across all users. These helpers persist
each generation per user + workspace so it survives restarts and stays isolated.
"""
from sqlalchemy.orm import Session

from ..models.student_profile import Flashcard, GeneratedQuestion


def persist_question(
    db: Session,
    question_id: str,
    question: dict,
    user_id: str | None,
    workspace_id: str | None,
    concept_ref: str | None,
) -> None:
    """Save one generated question (idempotent on question_id)."""
    if db.query(GeneratedQuestion).filter(GeneratedQuestion.id == question_id).first():
        return
    db.add(
        GeneratedQuestion(
            id=question_id,
            user_id=user_id,
            workspace_id=workspace_id,
            concept_ref=concept_ref,
            question_type=question.get("question_type"),
            difficulty=question.get("difficulty"),
            prompt=question.get("prompt", ""),
            options=question.get("options", []),
            correct_answer=question.get("correct_answer"),
            explanation=question.get("explanation"),
            evidence=question.get("evidence"),
            source_name=question.get("source_name"),
            expected_keywords=question.get("expected_keywords", []),
        )
    )
    db.commit()


def load_question(db: Session, question_id: str) -> dict | None:
    """Rehydrate a persisted question into the shape grading expects."""
    row = db.query(GeneratedQuestion).filter(GeneratedQuestion.id == question_id).first()
    if not row:
        return None
    return {
        "concept_id": row.concept_ref,
        "question_type": row.question_type,
        "difficulty": row.difficulty,
        "prompt": row.prompt,
        "options": row.options or [],
        "correct_answer": row.correct_answer,
        "explanation": row.explanation,
        "evidence": row.evidence,
        "source_name": row.source_name,
        "expected_keywords": row.expected_keywords or [],
    }


def persist_flashcards(
    db: Session,
    cards: list[dict],
    user_id: str | None,
    workspace_id: str | None,
    concept_ref: str | None,
) -> None:
    """Save generated flashcards, de-duplicating by (workspace, user, front)."""
    for card in cards:
        front = card.get("front", "")
        if not front:
            continue
        exists = (
            db.query(Flashcard)
            .filter(
                Flashcard.user_id == user_id,
                Flashcard.workspace_id == workspace_id,
                Flashcard.front == front,
            )
            .first()
        )
        if exists:
            continue
        db.add(
            Flashcard(
                user_id=user_id,
                front=front,
                back=card.get("back", ""),
                workspace_id=workspace_id,
                concept_ref=concept_ref,
                card_key=str(card.get("id", "")),
                source_name=card.get("source_name"),
                difficulty=card.get("difficulty"),
            )
        )
        # Flush per row: the GUID primary key is incompatible with SQLAlchemy's
        # batched "insertmanyvalues", so insert one row at a time.
        db.flush()
    db.commit()
