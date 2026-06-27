"""Helpers for grounding learning materials in uploaded source text."""

from __future__ import annotations

import re
from collections import Counter

from sqlalchemy.orm import Session

from ..models.source import Source, SourceChunk


STOPWORDS = {
    "about", "after", "again", "also", "because", "before", "being", "between",
    "could", "every", "from", "have", "into", "only", "other", "should",
    "that", "their", "there", "these", "this", "through", "what", "when",
    "where", "which", "with", "would", "your",
}


def keywords_for_text(text: str, limit: int = 8) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
    counts = Counter(word for word in words if word not in STOPWORDS)
    return [word for word, _ in counts.most_common(limit)]


def _score_text(text: str, concept_id: str, concept_name: str, keywords: list[str]) -> int:
    haystack = text.lower()
    score = 0
    for value in {concept_id.lower(), concept_name.lower()}:
        if value and value in haystack:
            score += 8
    score += sum(1 for keyword in keywords if keyword in haystack)
    return score


def source_context_for_concept(
    db: Session,
    workspace_id: str,
    concept: dict,
    limit: int = 3,
) -> list[dict]:
    """Return the most relevant source snippets for a concept."""
    concept_id = concept.get("id", "")
    concept_name = concept.get("display_name") or concept_id
    seed_text = " ".join(
        str(value)
        for value in [
            concept_id,
            concept_name,
            concept.get("description", ""),
            " ".join(concept.get("prerequisites", [])),
        ]
    )
    keywords = keywords_for_text(seed_text, limit=10)

    rows = (
        db.query(SourceChunk, Source)
        .join(Source, SourceChunk.source_id == Source.id)
        .filter(Source.workspace_id == workspace_id, Source.processing_status == "completed")
        .all()
    )

    ranked = []
    for chunk, source in rows:
        score = _score_text(chunk.text, concept_id, concept_name, keywords)
        if score <= 0:
            continue
        snippet = " ".join(chunk.text.split())[:420]
        ranked.append(
            {
                "source_id": source.id,
                "source_name": source.source_name,
                "chunk_id": chunk.id,
                "page_number": chunk.page_number,
                "snippet": snippet,
                "keywords": keywords_for_text(chunk.text, limit=6),
                "score": score,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[:limit]


def workspace_source_summary(db: Session, workspace_id: str) -> dict:
    sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
    completed = [source for source in sources if source.processing_status == "completed"]
    return {
        "total_sources": len(sources),
        "completed_sources": len(completed),
        "processing_sources": sum(1 for source in sources if source.processing_status in {"pending", "processing"}),
        "failed_sources": sum(1 for source in sources if source.processing_status == "failed"),
        "total_chunks": sum(source.chunk_count or 0 for source in completed),
        "total_entities": sum(source.entity_count or 0 for source in completed),
        "total_relationships": sum(source.relationship_count or 0 for source in completed),
        "source_types": dict(Counter(source.source_type for source in sources)),
    }
