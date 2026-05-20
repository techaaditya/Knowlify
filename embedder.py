from openai import OpenAI
import numpy as np
import os

def get_llm_client():
    return OpenAI(
        base_url=os.getenv("OLLAMA_BASE_URL"),
        api_key=os.getenv("OLLAMA_API_KEY")
    )

def embed_texts(texts: list[str], model='nomic-embed-text') -> list[list[float]]:
    client = get_llm_client()
    
    # We embed the topics so they can be searched semantically later
    response = client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]