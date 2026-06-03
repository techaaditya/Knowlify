# Socratic Tutor Engine
# Simulates interactive conversational chat prompts using Socratic inquiry methods.

def generate_socratic_prompt(concept: str, student_query: str) -> str:
    """
    Returns a prompt configuration for Ollama to guide the student towards answers.
    """
    return f"""
    You are a Socratic tutor teaching the concept of '{concept}'.
    Instead of directly answering the student's query, ask leading questions to guide their understanding.
    
    Student query: "{student_query}"
    
    Tutor Response:
    """
