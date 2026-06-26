from app.engines.generative.learning_materials import generate_flashcards, generate_quiz_questions


GRAPH = {
    "nodes": [
        {"id": "Atoms", "display_name": "Atoms", "description": "The basic units of matter.", "prerequisites": []},
        {"id": "Molecules", "display_name": "Molecules", "description": "Groups of atoms bonded together.", "prerequisites": ["Atoms"]},
    ],
    "edges": [{"from": "Atoms", "to": "Molecules"}],
}


def test_generated_quiz_uses_context_graph_relationships():
    questions = generate_quiz_questions(GRAPH, "Molecules", count=3)

    assert len(questions) == 3
    assert any(question["correct_answer"] == "Atoms" for question in questions)
    assert all(len(question["options"]) == 4 for question in questions)


def test_generated_flashcards_are_grounded_in_selected_concept():
    cards = generate_flashcards(GRAPH, "Molecules")

    assert len(cards) >= 3
    assert "Molecules" in cards[0]["front"]
    assert "atoms" in cards[0]["back"].lower()
