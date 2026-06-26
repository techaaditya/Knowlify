"""Small, source-grounded generators for practice questions and flashcards."""

from __future__ import annotations

from itertools import cycle


def _concepts(graph_data: dict) -> list[dict]:
    return [node for node in graph_data.get("nodes", []) if isinstance(node, dict) and node.get("id")]


def find_concept(graph_data: dict, concept_id: str) -> dict | None:
    return next((node for node in _concepts(graph_data) if node["id"] == concept_id), None)


def _name(node: dict) -> str:
    return node.get("display_name") or node["id"]


def _description(node: dict) -> str:
    return node.get("description") or f"A key concept extracted from the learner's uploaded sources: {_name(node)}."


def _choices(correct: str, alternatives: list[str]) -> list[str]:
    values = [correct] + [item for item in alternatives if item and item != correct]
    unique = list(dict.fromkeys(values))
    while len(unique) < 4:
        unique.append("This statement does not describe the selected concept.")
    return unique[:4]


def generate_quiz_questions(graph_data: dict, concept_id: str, count: int = 3) -> list[dict]:
    """Create explainable multiple-choice questions from the Context Engine graph."""
    concept = find_concept(graph_data, concept_id)
    if not concept:
        raise ValueError("Concept is not part of the workspace graph.")

    concepts = _concepts(graph_data)
    other_concepts = [node for node in concepts if node["id"] != concept_id]
    description = _description(concept)
    prerequisites = concept.get("prerequisites", [])
    downstream = [node for node in concepts if concept_id in node.get("prerequisites", [])]

    questions = [
        {
            "prompt": f"Which statement best describes {_name(concept)}?",
            "correct_answer": description,
            "alternatives": [_description(node) for node in other_concepts],
            "explanation": description,
        }
    ]

    if prerequisites:
        prerequisite = prerequisites[0]
        questions.append(
            {
                "prompt": f"Which concept should be reviewed before studying {_name(concept)}?",
                "correct_answer": prerequisite,
                "alternatives": [_name(node) for node in other_concepts if node["id"] != prerequisite],
                "explanation": f"{prerequisite} is listed as a prerequisite for {_name(concept)} in the workspace graph.",
            }
        )

    if downstream:
        next_concept = downstream[0]
        questions.append(
            {
                "prompt": f"Which concept depends on understanding {_name(concept)}?",
                "correct_answer": _name(next_concept),
                "alternatives": [_name(node) for node in other_concepts if node["id"] != next_concept["id"]],
                "explanation": f"The workspace graph links {_name(concept)} to {_name(next_concept)} as a prerequisite relationship.",
            }
        )

    # Small graphs may only have one relationship. Repeat a valid format rather
    # than inventing claims outside the uploaded learning material.
    result = []
    for item in cycle(questions):
        result.append(
            {
                "prompt": item["prompt"],
                "options": _choices(item["correct_answer"], item["alternatives"]),
                "correct_answer": item["correct_answer"],
                "explanation": item["explanation"],
            }
        )
        if len(result) >= max(1, min(count, 10)):
            break
    return result


def generate_flashcards(graph_data: dict, concept_id: str, count: int = 4) -> list[dict]:
    """Create concise revision cards from the selected graph concept."""
    concept = find_concept(graph_data, concept_id)
    if not concept:
        raise ValueError("Concept is not part of the workspace graph.")

    concept_name = _name(concept)
    prerequisites = concept.get("prerequisites", [])
    downstream = [node for node in _concepts(graph_data) if concept_id in node.get("prerequisites", [])]
    cards = [
        {"front": f"What is {concept_name}?", "back": _description(concept)},
        {
            "front": f"Why is {concept_name} important in this learning path?",
            "back": (
                f"It supports {', '.join(_name(node) for node in downstream)}."
                if downstream
                else "It is a concept identified in the selected learning sources."
            ),
        },
    ]
    if prerequisites:
        cards.append(
            {
                "front": f"What should you understand before {concept_name}?",
                "back": ", ".join(prerequisites),
            }
        )
    cards.append(
        {
            "front": f"Quick recall: where did {concept_name} come from?",
            "back": "The Context Engine extracted it from the learner's selected workspace sources.",
        }
    )
    return [
        {"id": f"{concept_id}-card-{index}", **card}
        for index, card in enumerate(cards[:max(1, min(count, 10))], start=1)
    ]
