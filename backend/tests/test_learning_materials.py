from app.engines.generative.learning_materials import generate_flashcards, generate_quiz_questions


GRAPH = {
    "nodes": [
        {"id": "Atoms", "display_name": "Atoms", "description": "The basic units of matter.", "prerequisites": []},
        {"id": "Molecules", "display_name": "Molecules", "description": "Groups of atoms bonded together.", "prerequisites": ["Atoms"]},
    ],
    "edges": [{"from": "Atoms", "to": "Molecules"}],
}


def test_generated_quiz_uses_context_graph_relationships():
    questions = generate_quiz_questions(GRAPH, "Molecules")

    assert len(questions) >= 3
    assert any(question["correct_answer"] == "Atoms" for question in questions)
    assert all(len(question["options"]) == 4 for question in questions)


def test_generated_flashcards_are_grounded_in_selected_concept():
    cards = generate_flashcards(
        GRAPH,
        "Molecules",
        source_context=[
            {
                "source_name": "biology-notes.pdf",
                "snippet": "Molecules form when atoms bond together. Their structure affects how matter behaves in chemical reactions.",
                "keywords": ["atoms", "bond", "structure"],
            }
        ],
    )

    assert len(cards) >= 3
    assert any("main idea" in card["front"] for card in cards)
    assert any("atoms bond together" in card["back"].lower() for card in cards)
    assert all("where did" not in card["front"].lower() for card in cards)


def test_generated_flashcards_include_learning_path_context():
    cards = generate_flashcards(GRAPH, "Atoms", count=5)

    assert any("unlock" in card["front"].lower() for card in cards)
    assert any("Molecules" in card["back"] for card in cards)
