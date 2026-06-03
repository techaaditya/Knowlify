import fitz  # PyMuPDF
import re
from typing import List, Dict
from langchain_text_splitters import RecursiveCharacterTextSplitter

def clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\b\d+\b(?=\s*$)', '', text)
    return text.strip()

def parse_pdf(filepath: str) -> List[Dict]:
    doc = fitz.open(filepath)
    chunks = []
    chunk_id = 0
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1024,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    for page_num, page in enumerate(doc):
        text = clean_text(page.get_text('text'))
        if not text:
            continue
            
        page_chunks = splitter.split_text(text)
        for pc in page_chunks:
            chunks.append({
                'chunk_id': f'chunk_{chunk_id}',
                'page': page_num + 1,
                'text': pc,
                'char_count': len(pc)
            })
            chunk_id += 1
            
    return chunks
