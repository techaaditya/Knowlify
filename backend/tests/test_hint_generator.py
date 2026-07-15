from app.engines.generative.hint_generator import generate_progressive_hints


def test_progressive_hints_reveal_information_gradually():
    question = {
        "question_type": "multiple_choice",
        "concept_id": "derivatives",
        "prompt": "Which statement best describes derivatives?",
        "correct_answer": "A derivative measures instantaneous rate of change.",
        "explanation": "Derivatives describe how quickly a function changes at a point.",
        "expected_keywords": ["rate of change", "instantaneous"],
        "evidence": "The derivative is introduced as a way to measure changing quantities.",
        "options": ["Slope at a point", "Area under a curve", "A matrix operation", "A sorting rule"],
    }

    hints = generate_progressive_hints(question, concept_name="Derivatives")

    assert len(hints) == 3
    assert hints[0]["reveals"] == "approach"
    assert "A derivative measures instantaneous rate of change" not in hints[0]["text"]
    assert "rate of change" in hints[1]["text"]
    assert "A derivative measures instantaneous rate of change" in hints[2]["text"]

