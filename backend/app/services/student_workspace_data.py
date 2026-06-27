"""Keeps a lightweight link between a learner's quiz attempts and a workspace."""

import json
import os


DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "student_workspace_data.json")


def _load() -> dict:
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def record_workspace_attempt(student_id: str, workspace_id: str, question_id: str) -> None:
    data = _load()
    data.setdefault(student_id, {})[question_id] = workspace_id
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def filter_profile_for_workspace(student_profile: dict, workspace_id: str, graph_data: dict) -> dict:
    """Return only concepts and attempts associated with one workspace."""
    concept_ids = {node.get("id") for node in graph_data.get("nodes", []) if isinstance(node, dict)}
    assignments = _load().get(student_profile["student_id"], {})
    profile = {**student_profile}
    profile["topics"] = {
        concept_id: topic
        for concept_id, topic in student_profile.get("topics", {}).items()
        if concept_id in concept_ids
    }
    profile["attempt_history"] = [
        attempt
        for attempt in student_profile.get("attempt_history", [])
        if assignments.get(attempt.get("question_id")) == workspace_id
        or (attempt.get("question_id") not in assignments and attempt.get("topic") in concept_ids)
    ]
    return profile
