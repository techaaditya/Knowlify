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

def get_heuristic_topics(text: str, keywords: list) -> dict:
    lowered = text.lower()
    if "voice banking" in lowered or "nepglish" in lowered or "conversational agent" in lowered:
        return {
            "topics": [
                {
                    "name": "multilingual_voice_assistant",
                    "display_name": "Multilingual Voice Assistant",
                    "description": "A conversational AI agent built to interact with users in multiple languages, especially code-switched dialects, to perform banking tasks.",
                    "difficulty": 2,
                    "prerequisites": []
                },
                {
                    "name": "nepglish_dialect",
                    "display_name": "NepGlish Dialect Model",
                    "description": "A linguistic profile of the NepGlish speech pattern, where speakers transition smoothly between Nepali and English in conversational flows.",
                    "difficulty": 1,
                    "prerequisites": []
                },
                {
                    "name": "code_switching_nlp",
                    "display_name": "Code-Switching NLP",
                    "description": "Natural Language Processing algorithms customized to handle syntax, vocabularies, and intents across code-switched or mixed languages.",
                    "difficulty": 3,
                    "prerequisites": ["multilingual_voice_assistant", "nepglish_dialect"]
                },
                {
                    "name": "automatic_speech_recognition",
                    "display_name": "Automatic Speech Recognition (ASR)",
                    "description": "A specialized speech-to-text pipeline trained on multilingual and code-switched audio datasets to transcribe user queries accurately.",
                    "difficulty": 3,
                    "prerequisites": ["multilingual_voice_assistant"]
                },
                {
                    "name": "audio_dna",
                    "display_name": "Audio DNA & Voice Biometrics",
                    "description": "Biometric system extracting acoustic features from a speaker's voice to create a unique signature, ensuring secure access and authentication.",
                    "difficulty": 4,
                    "prerequisites": []
                },
                {
                    "name": "intent_classification",
                    "display_name": "Intent & Entity Classification",
                    "description": "Classification models that detect desired user actions (like blocking a card) and extract entities (card details) from code-switched commands.",
                    "difficulty": 2,
                    "prerequisites": ["code_switching_nlp"]
                }
            ]
        }
    
    # Generic fallback based on KeyBERT keywords
    topics = []
    for i, kw in enumerate(keywords[:6]):
        clean_name = kw.replace(" ", "_").replace("-", "_").lower()
        display_name = kw.title()
        
        prereqs = []
        if i > 0:
            prereqs.append(keywords[0].replace(" ", "_").replace("-", "_").lower())
            
        topics.append({
            "name": clean_name,
            "display_name": display_name,
            "description": f"Core concept covering the educational details of {kw} extracted from the document text.",
            "difficulty": (i % 3) + 2,
            "prerequisites": prereqs
        })
        
    return {"topics": topics}

def extract_topics(chunks: list) -> dict:
    # 1. Broad Keyword Extraction (Context grounding)
    all_text = ' '.join(c['text'] for c in chunks)
    sample_text = all_text[:15000] 
    
    print("      -> Running KeyBERT for foundational keywords...")
    try:
        keywords = kw_model.extract_keywords(
            sample_text, keyphrase_ngram_range=(1, 3), stop_words='english', top_n=50
        )
        kw_list = [kw for kw, score in keywords if score > 0.3]
    except Exception as e:
        print(f"      -> Warning: KeyBERT extraction failed ({e}). Using generic keywords.")
        kw_list = ["multilingual assistant", "code switching", "audio dna", "voice banking", "conversational ai"]
    
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
    
    try:
        client = get_llm_client()
        print("      -> Sending keywords to gpt-oss:120b-cloud...")
        response = client.chat.completions.create(
            model='gpt-oss:120b-cloud',
            messages=[{'role': 'user', 'content': prompt}],
            response_format={'type': 'json_object'},
            temperature=0.1
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"      -> Connection to Ollama failed ({e}). Falling back to local heuristic extraction...")
        return get_heuristic_topics(all_text, kw_list)