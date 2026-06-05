from . import adaptive_engine, schemas
from .database import SessionLocal
from .seed_data import seed_demo_data


def run_demo():
    seed_demo_data()
    db = SessionLocal()
    try:
        attempt = schemas.AttemptInput(
            student_id="demo-student",
            concept_id="active_transport",
            question_id="q-active-1",
            correct=True,
            time_spent=38,
            hint_used=False,
            confidence=4,
            difficulty="medium",
        )
        mastery_record, previous_mastery = adaptive_engine.record_attempt(db, attempt)
        recommendation = adaptive_engine.get_recommendation(
            db,
            student_id="demo-student",
            concept_id="active_transport",
        )

        print("Knowlify Adaptive Learning Engine Demo")
        print("--------------------------------------")
        print(f"Previous mastery: {previous_mastery:.2f}")
        print(f"Updated mastery:  {mastery_record.mastery:.2f}")
        print(f"Next action:      {recommendation.next_action}")
        print(f"Recommended:      {recommendation.recommended_concept}")
        print(f"Reason:           {recommendation.reason}")
    finally:
        db.close()


if __name__ == "__main__":
    run_demo()
