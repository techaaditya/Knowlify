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


def parse_student_model_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def prerequisites_from_graph_data(graph_data: dict) -> dict[str, list[str]]:
    """
    Build prerequisite mappings from Context Engine graph data.

    Supports both graph node `prerequisites` fields and edge lists shaped like
    {"from": "Limits", "to": "Derivatives"}.
    """
    prerequisites: dict[str, set[str]] = {}

    for node in graph_data.get("nodes", []):
        concept_id = node.get("id")
        if not concept_id:
            continue
        prerequisites.setdefault(concept_id, set())
        for prereq_id in node.get("prerequisites", []):
            prerequisites[concept_id].add(prereq_id)

    for edge in graph_data.get("edges", []):
        prereq_id = edge.get("from")
        concept_id = edge.get("to")
        if prereq_id and concept_id:
            prerequisites.setdefault(concept_id, set()).add(prereq_id)
            prerequisites.setdefault(prereq_id, set())

    return {concept_id: sorted(prereq_ids) for concept_id, prereq_ids in prerequisites.items()}


def persistent_misconception(student_profile: Optional[dict], concept_id: str) -> Optional[str]:
    if not student_profile:
        return None

    topic_data = student_profile.get("topics", {}).get(concept_id, {})
    for error_type, count in topic_data.get("error_types", {}).items():
        if count >= 3:
            return error_type
    return None


def sync_from_student_model(
    db: Session,
    student_profile: dict,
    prerequisites_by_concept: Optional[dict[str, list[str]]] = None,
) -> list[models.MasteryRecord]:
    """
    Copy mastery from the Cognitive Student Model into Adaptive Engine records.

    The Student Model stores mastery as 0-100 percentages. The Adaptive Engine
    stores mastery as 0-1 floats, so this function converts the scale.
    """
    prerequisites_by_concept = prerequisites_by_concept or {}
    student_id = student_profile["student_id"]
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        student = models.Student(id=student_id, name=student_profile.get("name", student_id))
        db.add(student)
    else:
        student.name = student_profile.get("name", student.name)

    concept_ids = set(student_profile.get("topics", {}).keys())
    concept_ids.update(prerequisites_by_concept.keys())
    for prereqs in prerequisites_by_concept.values():
        concept_ids.update(prereqs)

    concepts: dict[str, models.Concept] = {}
    for concept_id in concept_ids:
        concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
        if not concept:
            concept = models.Concept(
                id=concept_id,
                name=concept_id,
                description=f"Concept synced from the Knowlify student model: {concept_id}",
            )
            db.add(concept)
        concepts[concept_id] = concept
    db.flush()

    for concept_id, prereq_ids in prerequisites_by_concept.items():
        concepts[concept_id].prerequisites = [concepts[prereq_id] for prereq_id in prereq_ids]

    synced_records = []
    for concept_id, topic_data in student_profile.get("topics", {}).items():
        record = get_or_create_mastery(db, student_id, concept_id)
        record.mastery = round(clamp(topic_data.get("mastery_score", 0) / 100), 3)
        record.last_practiced = parse_student_model_time(topic_data.get("last_revised"))
        synced_records.append(record)

    db.commit()
    return synced_records


def sync_from_student_model_and_graph(
    db: Session,
    student_profile: dict,
    graph_data: dict,
) -> list[models.MasteryRecord]:
    return sync_from_student_model(
        db,
        student_profile,
        prerequisites_by_concept=prerequisites_from_graph_data(graph_data),
    )


def record_attempt_from_student_model_payload(
    db: Session,
    student_profile: dict,
    attempt_payload: dict,
    confidence: int = 3,
    difficulty: str = "medium",
) -> tuple[models.MasteryRecord, float]:
    """
    Mirror a Student Model quiz attempt into Adaptive Engine records.

    This lets `/api/attempt` update both engines later without changing the
    Student Model class itself. The route can pass the same payload it already
    sends to the cognitive engine.
    """
    sync_from_student_model(db, student_profile)
    attempt = schemas.AttemptInput(
        student_id=student_profile["student_id"],
        concept_id=attempt_payload["topic_name"],
        question_id=attempt_payload["question_id"],
        correct=attempt_payload["is_correct"],
        time_spent=attempt_payload.get("time_taken", 0),
        hint_used=attempt_payload.get("hints_used", 0) > 0,
        confidence=confidence,
        difficulty=difficulty,
    )
    return record_attempt(db, attempt)


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


def get_recommendation(
    db: Session,
    student_id: str,
    concept_id: str,
    student_profile: Optional[dict] = None,
) -> schemas.Recommendation:
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
            mastery_source="Adaptive mastery synced from Student Model mastery_score",
        )

    misconception = persistent_misconception(student_profile, concept_id)
    if misconception:
        return schemas.Recommendation(
            student_id=student_id,
            concept_id=concept_id,
            concept_name=concept.name,
            current_mastery=mastery_record.mastery,
            forgetting_risk=risk,
            next_action="reteach",
            recommended_concept=concept_id,
            reason=(
                f"The student repeatedly makes '{misconception}' errors in {concept.name}. "
                "Recommend targeted reteaching before more practice."
            ),
            misconception=misconception,
            mastery_source="Adaptive mastery synced from Student Model mastery_score",
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
        mastery_source="Adaptive mastery synced from Student Model mastery_score",
    )


def shared_mastery_snapshot(db: Session, student_profile: dict) -> dict:
    """
    Return one combined view of cognitive and adaptive mastery records.

    This is a bridge toward a future shared mastery table without changing the
    existing Student Model Engine.
    """
    sync_from_student_model(db, student_profile)
    adaptive_records = {
        record.concept_id: record
        for record in db.query(models.MasteryRecord)
        .filter(models.MasteryRecord.student_id == student_profile["student_id"])
        .all()
    }

    concepts = {}
    for concept_id, topic_data in student_profile.get("topics", {}).items():
        adaptive_record = adaptive_records.get(concept_id)
        concepts[concept_id] = {
            "student_model_mastery_score": topic_data.get("mastery_score", 0),
            "adaptive_mastery": adaptive_record.mastery if adaptive_record else 0,
            "last_practiced": adaptive_record.last_practiced if adaptive_record else None,
            "status": topic_data.get("status"),
            "error_types": topic_data.get("error_types", {}),
        }

    return {
        "student_id": student_profile["student_id"],
        "name": student_profile.get("name"),
        "concepts": concepts,
    }


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
