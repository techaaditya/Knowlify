import json
import re
from typing import Any


def generate_ai_insights(text: str, topics: list[dict], entities: list[str]) -> dict[str, Any]:
    """Generate AI-like insights from extracted content. Uses heuristics with optional LLM."""
    words = text.split()
    word_count = len(words)

    summary = _generate_summary(text, topics)
    key_topics = [t.get("display_name", t.get("name", "")) for t in topics[:8]]
    if not key_topics:
        key_topics = _extract_keywords_heuristic(text)[:6]

    relationship_insights = []
    for topic in topics[:5]:
        prereqs = topic.get("prerequisites", [])
        if prereqs:
            relationship_insights.append(
                f"{topic.get('display_name', topic['name'])} requires understanding of {', '.join(prereqs)}"
            )
    if not relationship_insights and len(topics) >= 2:
        relationship_insights.append(
            f"Content connects {topics[0].get('display_name', '')} to {topics[1].get('display_name', '')}"
        )

    suggested_questions = [
        "What are the key concepts in this source?",
        "How does this relate to my other sources?",
        "What contradictions exist across sources?",
        f"What is the main argument about {key_topics[0]}?" if key_topics else "Summarize the main ideas.",
        "What prerequisites should I understand before diving deeper?",
    ]

    return {
        "ai_summary": summary,
        "key_topics": key_topics,
        "extracted_entities": entities[:15] if entities else key_topics[:10],
        "relationship_insights": relationship_insights[:5],
        "suggested_questions": suggested_questions[:5],
        "word_count": word_count,
    }


def _generate_summary(text: str, topics: list[dict]) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text[:3000])
    first_sentences = " ".join(s.strip() for s in sentences[:3] if s.strip())
    if topics:
        topic_names = ", ".join(t.get("display_name", t.get("name", "")) for t in topics[:4])
        return f"This source covers {topic_names}. {first_sentences[:400]}"
    return first_sentences[:500] if first_sentences else "Content imported successfully."


def _extract_keywords_heuristic(text: str) -> list[str]:
    words = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text[:5000])
    seen = set()
    result = []
    for w in words:
        if w.lower() not in seen and len(w) > 3:
            seen.add(w.lower())
            result.append(w)
    return result[:10]
