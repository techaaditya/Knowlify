"""Progressive, source-grounded hints for generated quiz questions."""

from __future__ import annotations


def _clean(text: str | None) -> str:
    return " ".join((text or "").replace("\n", " ").split())


def _shorten(text: str | None, limit: int = 220) -> str:
    cleaned = _clean(text)
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rsplit(' ', 1)[0]}..."


def _keywords(question: dict, concept_name: str) -> list[str]:
    values: list[str] = []
    for item in question.get("expected_keywords", []) or []:
        cleaned = _clean(str(item)).strip(".,:;()[]{}")
        if len(cleaned) > 2:
            values.append(cleaned)
    if concept_name:
        values.append(concept_name)
    return list(dict.fromkeys(values))[:5]


def generate_progressive_hints(
    question: dict,
    concept_name: str | None = None,
    student_answer: str | None = None,
) -> list[dict]:
    """Return three hints that reveal more support only when the learner asks.

    Level 1 protects the learning moment by giving only direction.
    Level 2 reveals the method or key terms to use.
    Level 3 gives a worked nudge that nearly reaches the answer.
    """
    concept_label = concept_name or question.get("concept_id") or "this concept"
    prompt = _shorten(question.get("prompt"), 260)
    answer = _shorten(question.get("correct_answer"), 240)
    explanation = _shorten(question.get("explanation"), 260)
    evidence = _shorten(question.get("evidence"), 260)
    keywords = _keywords(question, concept_label)
    keyword_text = ", ".join(keywords) if keywords else concept_label
    question_type = question.get("question_type", "multiple_choice")

    if question_type == "short_answer":
        level_2 = (
            f"Build your answer around these source/concept terms: {keyword_text}. "
            "A good short answer should connect the term to what the source is explaining."
        )
        level_3 = (
            f"Write it in this shape: '{concept_label} means ...; the source shows this because ...; "
            f"therefore the key idea is {answer}'."
        )
    else:
        options = question.get("options", []) or []
        option_hint = ""
        if options:
            option_hint = " Compare each option with the source idea instead of choosing the most familiar wording."
        level_2 = (
            f"Look for the option that matches the key idea: {keyword_text}."
            f"{option_hint}"
        )
        level_3 = (
            f"The correct choice should say the same idea as this: {answer}. "
            "Now match that meaning to the option list."
        )

    level_1 = (
        f"Pause on what the question is really asking: {prompt} "
        f"Focus on the role of {concept_label} before looking for the final answer."
    )
    if evidence:
        level_1 += f" The useful clue is in this source evidence: {evidence}"

    if student_answer:
        level_2 += f" Your current answer points to '{_shorten(student_answer, 120)}', so check whether it uses the main source idea."

    return [
        {
            "level": 1,
            "reveals": "approach",
            "title": "Hint 1: Direction",
            "text": level_1,
        },
        {
            "level": 2,
            "reveals": "method",
            "title": "Hint 2: Method",
            "text": level_2,
        },
        {
            "level": 3,
            "reveals": "answer_path",
            "title": "Hint 3: Worked Nudge",
            "text": f"{level_3} Why: {explanation}",
        },
    ]
