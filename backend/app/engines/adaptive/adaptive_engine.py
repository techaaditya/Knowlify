from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from . import models, schemas


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def get_or_create_mastery(db: Session, student_id: str, concept_id: str) -> models.MasteryRecord:
    record = (
        db.query(models.MasteryRecord)
        .filter(
            models.MasteryRecord.student_id == student_id,
            models.MasteryRecord.concept_id == concept_id,
        )
        .first()
    )
    if record:
        return record

    record = models.MasteryRecord(
        student_id=student_id,
        concept_id=concept_id,
        mastery=0.0,
        last_practiced=None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def calculate_mastery_change(attempt: schemas.AttemptInput) -> float:
    """Explainable scoring rule for the Knowlify adaptive learning MVP."""
    if attempt.correct:
        change = 0.08
        change += (attempt.confidence - 3) * 0.01
        if not attempt.hint_used:
            change += 0.03
        if attempt.time_spent <= 45:
            change += 0.02
        if attempt.difficulty == "hard":
            change += 0.04
        elif attempt.difficulty == "easy":
            change += 0.01
        return max(0.02, change)

    change = -0.08
    if attempt.hint_used:
        change -= 0.03
    if attempt.confidence >= 4:
        change -= 0.04
    if attempt.difficulty == "easy":
        change -= 0.04
    elif attempt.difficulty == "hard":
        change -= 0.01
    return change


def record_attempt(db: Session, attempt: schemas.AttemptInput) -> tuple[models.MasteryRecord, float]:
    student = db.query(models.Student).filter(models.Student.id == attempt.student_id).first()
    concept = db.query(models.Concept).filter(models.Concept.id == attempt.concept_id).first()
    if not student:
        raise ValueError(f"Student '{attempt.student_id}' does not exist.")
    if not concept:
        raise ValueError(f"Concept '{attempt.concept_id}' does not exist.")

    mastery_record = get_or_create_mastery(db, attempt.student_id, attempt.concept_id)
    previous_mastery = mastery_record.mastery

    mastery_record.mastery = round(clamp(previous_mastery + calculate_mastery_change(attempt)), 3)
    mastery_record.last_practiced = datetime.now(timezone.utc)

    db.add(
        models.Attempt(
            student_id=attempt.student_id,
            concept_id=attempt.concept_id,
            question_id=attempt.question_id,
            correct=attempt.correct,
            time_spent=attempt.time_spent,
            hint_used=attempt.hint_used,
            confidence=attempt.confidence,
            difficulty=attempt.difficulty,
        )
    )
    db.commit()
    db.refresh(mastery_record)
    return mastery_record, previous_mastery


def forgetting_risk(mastery: float, last_practiced: Optional[datetime]) -> str:
    if not last_practiced:
        return "high" if mastery < 0.75 else "low"

    now = datetime.now(timezone.utc)
    if last_practiced.tzinfo is None:
        last_practiced = last_practiced.replace(tzinfo=timezone.utc)
    days_since_practice = (now - last_practiced).days

    if days_since_practice >= 7 and mastery < 0.75:
        return "high"
    if days_since_practice >= 3 and mastery < 0.60:
        return "medium"
    return "low"


def weakest_prerequisite(
    db: Session, student_id: str, concept: models.Concept
) -> Optional[models.MasteryRecord]:
    weakest = None
    for prerequisite in concept.prerequisites:
        record = get_or_create_mastery(db, student_id, prerequisite.id)
        if record.mastery < 0.60 and (weakest is None or record.mastery < weakest.mastery):
            weakest = record
    return weakest


def get_recommendation(db: Session, student_id: str, concept_id: str) -> schemas.Recommendation:
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not student:
        raise ValueError(f"Student '{student_id}' does not exist.")
    if not concept:
        raise ValueError(f"Concept '{concept_id}' does not exist.")

    mastery_record = get_or_create_mastery(db, student_id, concept_id)
    risk = forgetting_risk(mastery_record.mastery, mastery_record.last_practiced)
    weak_prerequisite = weakest_prerequisite(db, student_id, concept)

    if weak_prerequisite:
        recommended = weak_prerequisite.concept
        return schemas.Recommendation(
            student_id=student_id,
            concept_id=concept_id,
            concept_name=concept.name,
            current_mastery=mastery_record.mastery,
            forgetting_risk=risk,
            next_action="prerequisite_review",
            recommended_concept=recommended.id,
            reason=(
                f"{recommended.name} is a prerequisite for {concept.name}, "
                f"but the student's mastery is only {weak_prerequisite.mastery:.2f}."
            ),
        )

    if risk == "high":
        next_action = "review"
        reason = f"{concept.name} is at high forgetting risk because practice is stale."
    elif mastery_record.mastery >= 0.85:
        next_action = "move_forward"
        reason = f"The student has strong mastery of {concept.name}."
    elif mastery_record.mastery >= 0.65:
        next_action = "harder_practice"
        reason = f"The student understands {concept.name} and is ready for harder practice."
    elif mastery_record.mastery >= 0.40:
        next_action = "explanation_then_practice"
        reason = f"The student has partial mastery of {concept.name} and needs guided practice."
    else:
        next_action = "reteach"
        reason = f"The student needs the core explanation of {concept.name} again."

    return schemas.Recommendation(
        student_id=student_id,
        concept_id=concept_id,
        concept_name=concept.name,
        current_mastery=mastery_record.mastery,
        forgetting_risk=risk,
        next_action=next_action,
        recommended_concept=None,
        reason=reason,
    )


def get_student_mastery(db: Session, student_id: str) -> list[schemas.MasterySummary]:
    records = (
        db.query(models.MasteryRecord)
        .filter(models.MasteryRecord.student_id == student_id)
        .all()
    )
    return [
        schemas.MasterySummary(
            concept_id=record.concept_id,
            concept_name=record.concept.name,
            mastery=record.mastery,
            forgetting_risk=forgetting_risk(record.mastery, record.last_practiced),
            last_practiced=record.last_practiced,
        )
        for record in records
    ]
