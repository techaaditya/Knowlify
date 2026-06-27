"""Small, source-grounded generators for practice questions and flashcards."""

from __future__ import annotations

import random


def _concepts(graph_data: dict) -> list[dict]:
    return [node for node in graph_data.get("nodes", []) if isinstance(node, dict) and node.get("id")]


def find_concept(graph_data: dict, concept_id: str) -> dict | None:
    return next((node for node in _concepts(graph_data) if node["id"] == concept_id), None)


def _name(node: dict) -> str:
    return node.get("display_name") or node["id"]


def _description(node: dict) -> str:
    return node.get("description") or f"A key concept extracted from the learner's uploaded sources: {_name(node)}."


def _choices(correct: str, alternatives: list[str], seed: str) -> list[str]:
    values = [correct] + [item for item in alternatives if item and item != correct]
    unique = list(dict.fromkeys(values))
    while len(unique) < 4:
        unique.append("This statement does not describe the selected concept.")
    values = unique[:4]
    random.Random(seed).shuffle(values)
    return values


def _evidence_text(source_context: list[dict]) -> str:
    if not source_context:
        return ""
    return source_context[0].get("snippet", "")


def _evidence_source(source_context: list[dict]) -> str | None:
    if not source_context:
        return None
    return source_context[0].get("source_name")


def _difficulty_prompt_prefix(difficulty: str) -> str:
    difficulty = difficulty.lower()
    if difficulty == "easy":
        return "Basic check:"
    if difficulty == "hard":
        return "Challenge:"
    return "Concept check:"


def generate_quiz_questions(
    graph_data: dict,
    concept_id: str,
    source_context: list[dict] | None = None,
    question_mode: str = "mixed",
    difficulty: str = "Medium",
) -> list[dict]:
    """Create a varied concept quiz from the Context Engine graph."""
    concept = find_concept(graph_data, concept_id)
    if not concept:
        raise ValueError("Concept is not part of the workspace graph.")

    source_context = source_context or []
    question_mode = question_mode.lower()
    difficulty_label = difficulty.capitalize()
    prompt_prefix = _difficulty_prompt_prefix(difficulty)
    concepts = _concepts(graph_data)
    other_concepts = [node for node in concepts if node["id"] != concept_id]
    description = _description(concept)
    evidence = _evidence_text(source_context)
    evidence_source = _evidence_source(source_context)
    prerequisites = concept.get("prerequisites", [])
    downstream = [node for node in concepts if concept_id in node.get("prerequisites", [])]

    questions = [
        {
            "question_type": "multiple_choice",
            "prompt": f"{prompt_prefix} Which statement best describes {_name(concept)}?",
            "correct_answer": description,
            "alternatives": [_description(node) for node in other_concepts],
            "explanation": description,
            "expected_keywords": [],
        }
    ]
    questions.append(
        {
            "question_type": "multiple_choice",
            "prompt": f"{prompt_prefix} Which concept from the selected sources matches this description: {description}",
            "correct_answer": _name(concept),
            "alternatives": [_name(node) for node in other_concepts],
            "explanation": f"The description identifies {_name(concept)} in the workspace graph.",
            "expected_keywords": [],
        }
    )

    if evidence:
        keywords = [
            word
            for word in (_name(concept), *description.split()[:8])
            if len(word.strip(".,:;()").lower()) > 3
        ]
        questions.append(
            {
                "question_type": "short_answer",
                "prompt": f"{prompt_prefix} In your own words, explain how this source excerpt relates to {_name(concept)}: \"{evidence[:220]}\"",
                "correct_answer": description,
                "alternatives": [],
                "explanation": f"A strong answer should connect the excerpt to {_name(concept)} using the source evidence.",
                "expected_keywords": list(dict.fromkeys(keywords))[:6],
            }
        )

    if prerequisites:
        prerequisite = prerequisites[0]
        questions.append(
            {
                "question_type": "multiple_choice",
                "prompt": f"{prompt_prefix} Which concept should be reviewed before studying {_name(concept)}?",
                "correct_answer": prerequisite,
                "alternatives": [_name(node) for node in other_concepts if node["id"] != prerequisite],
                "explanation": f"{prerequisite} is listed as a prerequisite for {_name(concept)} in the workspace graph.",
                "expected_keywords": [],
            }
        )

    if downstream:
        next_concept = downstream[0]
        questions.append(
            {
                "question_type": "multiple_choice",
                "prompt": f"{prompt_prefix} Which concept depends on understanding {_name(concept)}?",
                "correct_answer": _name(next_concept),
                "alternatives": [_name(node) for node in other_concepts if node["id"] != next_concept["id"]],
                "explanation": f"The workspace graph links {_name(concept)} to {_name(next_concept)} as a prerequisite relationship.",
                "expected_keywords": [],
            }
        )

    if question_mode == "mcq":
        questions = [item for item in questions if item["question_type"] == "multiple_choice"]
    elif question_mode == "short_answer":
        questions = [item for item in questions if item["question_type"] == "short_answer"]
        if not questions:
            questions = [
                {
                    "question_type": "short_answer",
                    "prompt": f"{prompt_prefix} Explain {_name(concept)} in your own words using the selected source knowledge.",
                    "correct_answer": description,
                    "alternatives": [],
                    "explanation": f"A strong answer should explain the meaning and role of {_name(concept)}.",
                    "expected_keywords": [_name(concept), *description.split()[:8]],
                }
            ]

    if difficulty_label == "Easy":
        questions = questions[: max(1, min(2, len(questions)))]
    elif difficulty_label == "Hard":
        questions = questions + [
            {
                "question_type": "short_answer",
                "prompt": f"Challenge: Explain why misunderstanding {_name(concept)} could block later concepts in the graph.",
                "correct_answer": f"{_name(concept)} supports later concepts in the learning path.",
                "alternatives": [],
                "explanation": f"Hard questions check transfer: how {_name(concept)} affects connected concepts.",
                "expected_keywords": [_name(concept), *[_name(node) for node in downstream[:2]]],
            }
        ]

    return [
        {
            "question_type": item["question_type"],
            "difficulty": difficulty_label,
            "prompt": item["prompt"],
            "options": (
                _choices(item["correct_answer"], item["alternatives"], f"{concept_id}-{index}")
                if item["question_type"] == "multiple_choice"
                else []
            ),
            "correct_answer": item["correct_answer"],
            "explanation": item["explanation"],
            "expected_keywords": item["expected_keywords"],
            "evidence": evidence,
            "source_name": evidence_source,
        }
        for index, item in enumerate(questions, start=1)
    ]


def generate_flashcards(
    graph_data: dict,
    concept_id: str,
    count: int = 4,
    source_context: list[dict] | None = None,
) -> list[dict]:
    """Create concise revision cards from the selected graph concept."""
    concept = find_concept(graph_data, concept_id)
    if not concept:
        raise ValueError("Concept is not part of the workspace graph.")

    source_context = source_context or []
    concept_name = _name(concept)
    evidence = _evidence_text(source_context)
    evidence_source = _evidence_source(source_context)
    prerequisites = concept.get("prerequisites", [])
    downstream = [node for node in _concepts(graph_data) if concept_id in node.get("prerequisites", [])]
    cards = [
        {"front": f"What is {concept_name}?", "back": _description(concept), "difficulty": "again"},
        {
            "front": f"Why is {concept_name} important in this learning path?",
            "back": (
                f"It supports {', '.join(_name(node) for node in downstream)}."
                if downstream
                else "It is a concept identified in the selected learning sources."
            ),
            "difficulty": "good",
        },
    ]
    if evidence:
        cards.append(
            {
                "front": f"What source evidence helps explain {concept_name}?",
                "back": evidence,
                "difficulty": "hard",
            }
        )
    if prerequisites:
        cards.append(
            {
                "front": f"What should you understand before {concept_name}?",
                "back": ", ".join(prerequisites),
                "difficulty": "hard",
            }
        )
    cards.append(
        {
            "front": f"Quick recall: where did {concept_name} come from?",
            "back": (
                f"The Context Engine extracted it from {evidence_source}."
                if evidence_source
                else "The Context Engine extracted it from the learner's selected workspace sources."
            ),
            "difficulty": "easy",
        }
    )
    return [
        {"id": f"{concept_id}-card-{index}", "source_name": evidence_source, **card}
        for index, card in enumerate(cards[:max(1, min(count, 10))], start=1)
    ]
