from typing import List, Dict
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .cleaner import normalize_content


def chunk_text(text: str, source_label: str = "source") -> List[Dict]:
    text = normalize_content(text)
    if not text:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1024,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    parts = splitter.split_text(text)
    chunks = []
    for idx, part in enumerate(parts):
        chunks.append({
            "chunk_id": f"{source_label}_chunk_{idx}",
            "chunk_index": idx,
            "page": None,
            "text": part,
            "char_count": len(part),
        })
    return chunks
