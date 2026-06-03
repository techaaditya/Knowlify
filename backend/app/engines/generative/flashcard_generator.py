# Flashcard Generator Engine
# Prompts the LLM/Ollama to generate flashcards based on conceptual text descriptions.

def generate_flashcards(concept_name: str, concept_description: str) -> list[dict]:
    """
    Simulates or requests Ollama prompts to construct flashcards for study aids.
    """
    return [
        {
            "id": f"fc_{concept_name}_1",
            "front": f"What is the primary definition of {concept_name}?",
            "back": concept_description
        },
        {
            "id": f"fc_{concept_name}_2",
            "front": f"Explain the core utility of {concept_name}.",
            "back": f"Understanding {concept_name} helps map dependencies in learning graphs."
        }
    ]
