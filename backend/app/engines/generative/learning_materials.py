"""Small, source-grounded generators for practice questions and flashcards."""

from __future__ import annotations

import random
import re


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


def _clean_text(text: str) -> str:
    return " ".join((text or "").replace("\n", " ").split())


def _shorten(text: str, limit: int = 280) -> str:
    text = _clean_text(text)
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rsplit(' ', 1)[0]}..."


def _sentences(text: str) -> list[str]:
    cleaned = _clean_text(text)
    pieces = re.split(r"(?<=[.!?])\s+", cleaned)
    sentences = []
    for piece in pieces:
        sentence = piece.strip(" -•")
        if len(sentence) < 35 or len(sentence) > 320:
            continue
        alpha_ratio = sum(ch.isalpha() for ch in sentence) / max(1, len(sentence))
        if alpha_ratio < 0.25:
            continue
        sentences.append(sentence)
    return sentences


def _source_keywords(source_context: list[dict]) -> list[str]:
    keywords: list[str] = []
    for item in source_context:
        for keyword in item.get("keywords", []) or []:
            cleaned = _clean_text(str(keyword)).strip(".,:;()[]{}")
            if len(cleaned) > 3:
                keywords.append(cleaned)
    return list(dict.fromkeys(keywords))[:8]


def _best_evidence_sentences(source_context: list[dict], concept_name: str, limit: int = 3) -> list[str]:
    if not source_context:
        return []

    concept_terms = [term.lower() for term in re.split(r"[\s_/-]+", concept_name) if len(term) > 3]
    keyword_terms = [keyword.lower() for keyword in _source_keywords(source_context)]
    scored: list[tuple[int, str]] = []
    for item in source_context:
        fallback = _shorten(item.get("snippet", ""), 240)
        candidates = _sentences(item.get("snippet", "")) or ([fallback] if fallback else [])
        for sentence in candidates:
            lower = sentence.lower()
            score = sum(2 for term in concept_terms if term in lower)
            score += sum(1 for term in keyword_terms if term and term in lower)
            scored.append((score, sentence))

    scored.sort(key=lambda value: (value[0], len(value[1])), reverse=True)
    unique = []
    for _, sentence in scored:
        if sentence and sentence not in unique:
            unique.append(sentence)
        if len(unique) == limit:
            break
    return unique


def _friendly_list(values: list[str]) -> str:
    values = [value for value in values if value]
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return f"{values[0]} and {values[1]}"
    return f"{', '.join(values[:-1])}, and {values[-1]}"


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
    """Create concise, source-grounded revision cards from the selected graph concept."""
    concept = find_concept(graph_data, concept_id)
    if not concept:
        raise ValueError("Concept is not part of the workspace graph.")

    source_context = source_context or []
    concept_name = _name(concept)
    evidence_source = _evidence_source(source_context)
    evidence_sentences = _best_evidence_sentences(source_context, concept_name)
    source_keywords = _source_keywords(source_context)
    prerequisites = concept.get("prerequisites", [])
    concepts_by_id = {node["id"]: _name(node) for node in _concepts(graph_data)}
    prerequisite_names = [concepts_by_id.get(item, item) for item in prerequisites]
    downstream = [node for node in _concepts(graph_data) if concept_id in node.get("prerequisites", [])]
    downstream_names = [_name(node) for node in downstream[:4]]
    description = _description(concept)

    definition_answer = description
    if evidence_sentences:
        definition_answer = f"{_shorten(description, 180)} Source note: {_shorten(evidence_sentences[0], 220)}"

    cards = [
        {
            "front": f"What is the main idea of {concept_name}?",
            "back": definition_answer,
            "difficulty": "good",
            "focus": "definition",
        },
        {
            "front": f"Explain {concept_name} in your own words.",
            "back": (
                _shorten(evidence_sentences[1], 260)
                if len(evidence_sentences) > 1
                else f"A strong explanation should describe {concept_name} and connect it to the selected source material."
            ),
            "difficulty": "good",
            "focus": "explanation",
        },
    ]

    if evidence_sentences:
        cards.append(
            {
                "front": f"What should you remember about {concept_name} from the source?",
                "back": _shorten(evidence_sentences[-1], 260),
                "difficulty": "hard",
                "focus": "source evidence",
            }
        )

    if prerequisites:
        cards.append(
            {
                "front": f"What should you review before studying {concept_name}?",
                "back": f"Review {_friendly_list(prerequisite_names)} first because the graph marks them as prerequisites for {concept_name}.",
                "difficulty": "hard",
                "focus": "prerequisites",
            }
        )

    if downstream_names:
        cards.append(
            {
                "front": f"Which later topics can {concept_name} help unlock?",
                "back": f"{concept_name} is connected to {_friendly_list(downstream_names)} in the knowledge graph, so weak recall here can affect those later topics.",
                "difficulty": "hard",
                "focus": "learning path",
            }
        )

    if source_keywords:
        cards.append(
            {
                "front": f"Name one key term connected to {concept_name}.",
                "back": f"Useful connected terms from the source include {_friendly_list(source_keywords[:4])}.",
                "difficulty": "easy",
                "focus": "keywords",
            }
        )

    cards.append(
        {
            "front": f"How can you check whether you understand {concept_name}?",
            "back": f"Try to define {concept_name}, give one example from the source, and explain how it connects to a prerequisite or later topic in the graph.",
            "difficulty": "easy",
            "focus": "self check",
        }
    )

    unique_cards = []
    seen_fronts = set()
    for card in cards:
        if card["front"] in seen_fronts:
            continue
        seen_fronts.add(card["front"])
        unique_cards.append(card)

    max_count = max(1, min(count, 10))
    selected_cards = unique_cards[:max_count]
    while len(selected_cards) < max_count and selected_cards:
        selected_cards.append(
            {
                **selected_cards[len(selected_cards) % len(unique_cards)],
                "front": f"Practice recall: {selected_cards[len(selected_cards) % len(unique_cards)]['front']}",
            }
        )

    return [
        {"id": f"{concept_id}-card-{index}", "source_name": evidence_source, **card}
        for index, card in enumerate(selected_cards, start=1)
    ]
