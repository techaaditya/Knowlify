from keybert import KeyBERT
from openai import OpenAI
import json
import os

kw_model = KeyBERT() 

def get_llm_client():
    return OpenAI(
        base_url=os.getenv("OLLAMA_BASE_URL"),
        api_key=os.getenv("OLLAMA_API_KEY")
    )

def extract_topics(chunks: list) -> dict:
    client = get_llm_client()
    
    # 1. Broad Keyword Extraction (Context grounding)
    all_text = ' '.join(c['text'] for c in chunks)
    sample_text = all_text[:15000] 
    
    print("      -> Running KeyBERT for foundational keywords...")
    keywords = kw_model.extract_keywords(
        sample_text, keyphrase_ngram_range=(1, 3), stop_words='english', top_n=50
    )
    kw_list = [kw for kw, score in keywords if score > 0.3]
    
    # 2. LLM Entity & Relationship Extraction
    prompt = f"""
    You are an expert AI building an educational knowledge graph.
    Analyze these extracted keywords and the document context to identify core concepts.
    
    Keywords: {kw_list}
    
    Rules for Extraction:
    1. Entity Resolution: Group synonyms into a single canonical 'name' using snake_case.
    2. Relationship Extraction: Determine strict prerequisite relationships. (If A MUST be learned before B, A is a prerequisite of B).
    
    Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
    {{
      "topics": [
        {{
          "name": "canonical_topic_name", 
          "display_name": "Topic Name",
          "description": "2-3 sentence overview of the concept",
          "difficulty": 1, 
          "prerequisites": ["other_canonical_topic_name"]
        }}
      ]
    }}
    """
    
    print("      -> Sending keywords to gpt-oss:120b-cloud...")
    response = client.chat.completions.create(
        model='gpt-oss:120b-cloud',
        messages=[{'role': 'user', 'content': prompt}],
        response_format={'type': 'json_object'},
        temperature=0.1
    )
    
    return json.loads(response.choices[0].message.content)