# Adaptive Learning Engine

Engine 3 handles adaptive recommendations for Knowlify. It is intentionally written as internal Python logic so the main backend and other engines can call it directly.

## Responsibilities

- Record student quiz attempts.
- Update concept mastery from `0` to `1`.
- Detect forgetting risk from mastery and last practice date.
- Check prerequisite weaknesses before moving a student forward.
- Sync mastery from the Cognitive Student Model without changing the Student Model engine.
- Use repeated Student Model error types for misconception-specific reteaching.
- Read prerequisite relationships from Context Engine-style graph data.
- Return a plain-English next learning recommendation.

## Demo Concepts

The seed data uses:

- ATP
- Cell Membrane
- Concentration Gradient
- Active Transport

Active Transport depends on ATP, Cell Membrane, and Concentration Gradient. The demo student has low ATP mastery, so Active Transport recommends prerequisite review.

## Run Demo

From the `backend` folder:

```bash
python -m app.engines.adaptive.demo
```

## Run Tests

From the `backend` folder:

```bash
pytest
```

## Integration Example

```python
from app.engines.adaptive import adaptive_engine, schemas
from app.engines.adaptive.database import SessionLocal

db = SessionLocal()

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
recommendation = adaptive_engine.get_recommendation(db, "demo-student", "active_transport")

db.close()
```

## Student Model Integration

The adaptive engine can use the existing Cognitive Student Model as the source of truth for mastery:

```python
student_profile = cognitive_engine.get_student("S001")
adaptive_engine.sync_from_student_model_and_graph(db, student_profile, graph_data)
recommendation = adaptive_engine.get_recommendation(
    db,
    student_id="S001",
    concept_id="Derivatives",
    student_profile=student_profile,
)
```

What happens:

- Student Model `mastery_score` is converted from `0-100` into Adaptive mastery `0-1`.
- Student Model `last_revised` becomes Adaptive `last_practiced`.
- Context Engine graph edges become prerequisites.
- Student Model `error_types` with repeated mistakes can force a targeted `reteach` recommendation.

This keeps the Student Model code unchanged while letting the Adaptive Engine use its data.
