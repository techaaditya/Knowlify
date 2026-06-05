from datetime import datetime, timedelta, timezone

from .database import Base, SessionLocal, engine
from .models import Concept, MasteryRecord, Student


def upsert_concept(db, concept_id: str, name: str, description: str) -> Concept:
    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    if concept:
        concept.name = name
        concept.description = description
        return concept

    concept = Concept(id=concept_id, name=name, description=description)
    db.add(concept)
    return concept


def upsert_mastery(db, student_id: str, concept_id: str, mastery: float, days_ago: int):
    record = (
        db.query(MasteryRecord)
        .filter(MasteryRecord.student_id == student_id, MasteryRecord.concept_id == concept_id)
        .first()
    )
    practiced_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    if record:
        record.mastery = mastery
        record.last_practiced = practiced_at
        return

    db.add(
        MasteryRecord(
            student_id=student_id,
            concept_id=concept_id,
            mastery=mastery,
            last_practiced=practiced_at,
        )
    )


def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.id == "demo-student").first()
        if not student:
            student = Student(id="demo-student", name="Demo Student")
            db.add(student)

        atp = upsert_concept(db, "atp", "ATP", "The energy currency cells use to power work.")
        membrane = upsert_concept(
            db,
            "cell_membrane",
            "Cell Membrane",
            "The boundary that controls what enters and leaves the cell.",
        )
        gradient = upsert_concept(
            db,
            "concentration_gradient",
            "Concentration Gradient",
            "A difference in concentration across a space or membrane.",
        )
        active_transport = upsert_concept(
            db,
            "active_transport",
            "Active Transport",
            "Movement of substances across a membrane using cellular energy.",
        )

        active_transport.prerequisites = [atp, membrane, gradient]
        db.flush()

        upsert_mastery(db, "demo-student", "atp", 0.35, days_ago=1)
        upsert_mastery(db, "demo-student", "cell_membrane", 0.72, days_ago=1)
        upsert_mastery(db, "demo-student", "concentration_gradient", 0.68, days_ago=1)
        upsert_mastery(db, "demo-student", "active_transport", 0.50, days_ago=0)

        db.commit()
        print("Seeded adaptive engine demo data.")
        print("Try: python -m app.engines.adaptive.demo")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
