from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.engines.adaptive import adaptive_engine, models, schemas
from app.engines.adaptive.database import Base


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    seed_test_data(session)
    try:
        yield session
    finally:
        session.close()


def seed_test_data(db):
    student = models.Student(id="student-1", name="Test Student")
    atp = models.Concept(id="atp", name="ATP")
    membrane = models.Concept(id="cell_membrane", name="Cell Membrane")
    gradient = models.Concept(id="concentration_gradient", name="Concentration Gradient")
    active_transport = models.Concept(id="active_transport", name="Active Transport")
    active_transport.prerequisites = [atp, membrane, gradient]

    db.add_all([student, atp, membrane, gradient, active_transport])
    db.flush()
    db.add_all(
        [
            models.MasteryRecord(student_id="student-1", concept_id="atp", mastery=0.35),
            models.MasteryRecord(student_id="student-1", concept_id="cell_membrane", mastery=0.75),
            models.MasteryRecord(student_id="student-1", concept_id="concentration_gradient", mastery=0.75),
            models.MasteryRecord(student_id="student-1", concept_id="active_transport", mastery=0.50),
        ]
    )
    db.commit()


def make_attempt(correct: bool, **overrides):
    data = {
        "student_id": "student-1",
        "concept_id": "active_transport",
        "question_id": "q1",
        "correct": correct,
        "time_spent": 40,
        "hint_used": False,
        "confidence": 4,
        "difficulty": "medium",
    }
    data.update(overrides)
    return schemas.AttemptInput(**data)


def mastery_for(db, concept_id: str):
    return (
        db.query(models.MasteryRecord)
        .filter(
            models.MasteryRecord.student_id == "student-1",
            models.MasteryRecord.concept_id == concept_id,
        )
        .first()
    )


def test_mastery_increases_after_correct_answer(db):
    before = mastery_for(db, "active_transport").mastery
    record, _ = adaptive_engine.record_attempt(db, make_attempt(correct=True))
    assert record.mastery > before


def test_mastery_decreases_after_wrong_answer(db):
    before = mastery_for(db, "active_transport").mastery
    record, _ = adaptive_engine.record_attempt(
        db,
        make_attempt(correct=False, hint_used=True, confidence=5, difficulty="easy"),
    )
    assert record.mastery < before


def test_mastery_never_goes_below_zero_or_above_one(db):
    record = mastery_for(db, "active_transport")
    record.mastery = 0.99
    db.commit()
    record, _ = adaptive_engine.record_attempt(
        db,
        make_attempt(correct=True, confidence=5, difficulty="hard"),
    )
    assert record.mastery == 1.0

    record.mastery = 0.01
    db.commit()
    record, _ = adaptive_engine.record_attempt(
        db,
        make_attempt(correct=False, hint_used=True, confidence=5, difficulty="easy"),
    )
    assert record.mastery == 0.0


def test_high_forgetting_risk_works():
    stale_date = datetime.now(timezone.utc) - timedelta(days=8)
    risk = adaptive_engine.forgetting_risk(0.70, stale_date)
    assert risk == "high"


def test_prerequisite_review_is_returned_when_atp_mastery_is_low(db):
    recommendation = adaptive_engine.get_recommendation(
        db,
        "student-1",
        "active_transport",
    )
    assert recommendation.next_action == "prerequisite_review"
    assert recommendation.recommended_concept == "atp"


def test_move_forward_when_mastery_is_high_and_prerequisites_are_strong(db):
    for concept_id in ["atp", "cell_membrane", "concentration_gradient", "active_transport"]:
        record = mastery_for(db, concept_id)
        record.mastery = 0.90
        record.last_practiced = datetime.now(timezone.utc)
    db.commit()

    recommendation = adaptive_engine.get_recommendation(
        db,
        "student-1",
        "active_transport",
    )
    assert recommendation.next_action == "move_forward"


def test_sync_from_student_model_converts_mastery_scale(db):
    student_profile = {
        "student_id": "S002",
        "name": "Cognitive Student",
        "topics": {
            "Limits": {
                "mastery_score": 72.5,
                "last_revised": "2026-06-10 10:00:00",
            },
            "Derivatives": {
                "mastery_score": 35,
                "last_revised": "2026-06-10 10:05:00",
            },
        },
    }

    adaptive_engine.sync_from_student_model(
        db,
        student_profile,
        prerequisites_by_concept={"Derivatives": ["Limits"]},
    )

    limits = (
        db.query(models.MasteryRecord)
        .filter(models.MasteryRecord.student_id == "S002", models.MasteryRecord.concept_id == "Limits")
        .first()
    )
    derivatives = (
        db.query(models.MasteryRecord)
        .filter(models.MasteryRecord.student_id == "S002", models.MasteryRecord.concept_id == "Derivatives")
        .first()
    )

    assert limits.mastery == 0.725
    assert derivatives.mastery == 0.35


def test_student_model_last_revised_becomes_last_practiced(db):
    student_profile = {
        "student_id": "S003",
        "name": "Practice Date Student",
        "topics": {
            "Limits": {
                "mastery_score": 80,
                "last_revised": "2026-06-10 10:00:00",
            },
        },
    }

    adaptive_engine.sync_from_student_model(db, student_profile)
    record = (
        db.query(models.MasteryRecord)
        .filter(models.MasteryRecord.student_id == "S003", models.MasteryRecord.concept_id == "Limits")
        .first()
    )

    assert record.last_practiced.year == 2026
    assert record.last_practiced.month == 6
    assert record.last_practiced.day == 10


def test_prerequisites_from_context_graph_data(db):
    graph_data = {
        "nodes": [
            {"id": "Chain Rule", "prerequisites": ["Derivatives"]},
            {"id": "Limits"},
        ],
        "edges": [
            {"from": "Limits", "to": "Derivatives"},
        ],
    }

    prerequisites = adaptive_engine.prerequisites_from_graph_data(graph_data)

    assert prerequisites["Chain Rule"] == ["Derivatives"]
    assert prerequisites["Derivatives"] == ["Limits"]


def test_repeated_student_model_error_type_recommends_reteach(db):
    for concept_id in ["atp", "cell_membrane", "concentration_gradient", "active_transport"]:
        record = mastery_for(db, concept_id)
        record.mastery = 0.75
        record.last_practiced = datetime.now(timezone.utc)
    db.commit()

    student_profile = {
        "student_id": "student-1",
        "topics": {
            "active_transport": {
                "error_types": {"Formula mistake": 3},
            },
        },
    }

    recommendation = adaptive_engine.get_recommendation(
        db,
        "student-1",
        "active_transport",
        student_profile=student_profile,
    )

    assert recommendation.next_action == "reteach"
    assert recommendation.misconception == "Formula mistake"
    assert recommendation.recommended_concept == "active_transport"


def test_record_attempt_from_student_model_payload_updates_adaptive_mastery(db):
    student_profile = {
        "student_id": "S004",
        "name": "Attempt Sync Student",
        "topics": {
            "Limits": {
                "mastery_score": 50,
                "last_revised": "2026-06-10 10:00:00",
            },
        },
    }
    attempt_payload = {
        "topic_name": "Limits",
        "question_id": "Q1",
        "is_correct": True,
        "time_taken": 30,
        "hints_used": 0,
    }

    record, previous_mastery = adaptive_engine.record_attempt_from_student_model_payload(
        db,
        student_profile,
        attempt_payload,
        confidence=4,
        difficulty="medium",
    )

    assert previous_mastery == 0.5
    assert record.mastery > previous_mastery


def test_shared_mastery_snapshot_uses_student_model_mastery(db):
    student_profile = {
        "student_id": "S005",
        "name": "Shared Mastery Student",
        "topics": {
            "Limits": {
                "mastery_score": 72.5,
                "last_revised": "2026-06-10 10:00:00",
                "status": "learning",
                "error_types": {"Sign error": 1},
            },
        },
    }

    snapshot = adaptive_engine.shared_mastery_snapshot(db, student_profile)

    assert snapshot["concepts"]["Limits"]["student_model_mastery_score"] == 72.5
    assert snapshot["concepts"]["Limits"]["adaptive_mastery"] == 0.725
    assert snapshot["concepts"]["Limits"]["error_types"] == {"Sign error": 1}
