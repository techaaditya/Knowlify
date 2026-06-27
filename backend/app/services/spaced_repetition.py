"""JSON-backed spaced repetition state for the MVP flashcard flow."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta


DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "flashcard_reviews.json")
RATING_INTERVALS = {
    "again": 0,
    "hard": 1,
    "good": 3,
    "easy": 7,
}


def _load() -> dict:
    if not os.path.exists(DATA_FILE):
        return {}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError:
        return {}


def _save(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def record_flashcard_review(
    student_id: str,
    workspace_id: str,
    concept_id: str,
    card_id: str,
    rating: str,
) -> dict:
    rating = rating.lower()
    if rating not in RATING_INTERVALS:
        raise ValueError("Rating must be again, hard, good, or easy.")

    data = _load()
    key = f"{student_id}:{workspace_id}:{card_id}"
    previous = data.get(key, {})
    reviews = int(previous.get("reviews", 0)) + 1
    interval_days = RATING_INTERVALS[rating]
    if rating == "easy" and reviews > 1:
        interval_days += min(14, reviews * 2)

    now = datetime.now()
    next_review = now + timedelta(days=interval_days)
    record = {
        "student_id": student_id,
        "workspace_id": workspace_id,
        "concept_id": concept_id,
        "card_id": card_id,
        "rating": rating,
        "reviews": reviews,
        "last_reviewed": now.strftime("%Y-%m-%d %H:%M:%S"),
        "next_review_date": next_review.strftime("%Y-%m-%d"),
    }
    data[key] = record
    _save(data)
    return record


def due_flashcard_reviews(student_id: str, workspace_id: str | None = None) -> list[dict]:
    today = datetime.now().date()
    reviews = []
    for record in _load().values():
        if record.get("student_id") != student_id:
            continue
        if workspace_id and record.get("workspace_id") != workspace_id:
            continue
        next_review = datetime.strptime(record["next_review_date"], "%Y-%m-%d").date()
        if next_review <= today:
            reviews.append(record)
    return sorted(reviews, key=lambda item: item["next_review_date"])
