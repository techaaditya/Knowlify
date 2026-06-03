# ACLS – Complete Codebase
# Every file you need to build the system

---

## ═══════════════════════════════════════
## BACKEND
## ═══════════════════════════════════════

---

### FILE: backend/requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
openai==1.30.1
chromadb==0.5.0
networkx==3.3
PyMuPDF==1.24.4
pdfplumber==0.11.1
spacy==3.7.4
celery[redis]==5.4.0
redis==5.0.6
pydantic==2.7.2
pydantic-settings==2.3.0
python-dotenv==1.0.1
httpx==0.27.0
sentence-transformers==3.0.1
numpy==1.26.4
```

---

### FILE: backend/app/config.py

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://acls_user:acls_pass@localhost:5432/acls"
    
    # Auth
    SECRET_KEY: str = "change-this-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_CHAT_MODEL: str = "gpt-4o"
    
    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379"
    
    # Storage
    UPLOAD_DIR: str = "./uploads"
    
    # ChromaDB
    CHROMA_PATH: str = "./chroma_db"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
```

---

### FILE: backend/app/database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency for DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### FILE: backend/app/models/user.py

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    topic_masteries = relationship("TopicMastery", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
```

---

### FILE: backend/app/models/document.py

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500))
    filename = Column(String(500))
    file_path = Column(String(1000))
    status = Column(String(50), default="pending")  # pending, processing, complete, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="documents")
    concepts = relationship("Concept", back_populates="document", cascade="all, delete-orphan")


class Concept(Base):
    __tablename__ = "concepts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    chunk_text = Column(Text)
    page_number = Column(Integer)
    embedding_id = Column(String(255))   # ID in ChromaDB
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="concepts")
    masteries = relationship("TopicMastery", back_populates="concept")
    
    # Many-to-many with itself via concept_prerequisites
    prerequisites = relationship(
        "Concept",
        secondary="concept_prerequisites",
        primaryjoin="Concept.id == concept_prerequisites.c.concept_id",
        secondaryjoin="Concept.id == concept_prerequisites.c.prerequisite_id"
    )


class ConceptPrerequisite(Base):
    __tablename__ = "concept_prerequisites"
    
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), primary_key=True)
    prerequisite_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), primary_key=True)
    confidence = Column(String(50), default="1.0")
    source = Column(String(50), default="llm")   # llm, document_order, embedding
```

---

### FILE: backend/app/models/student_profile.py

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base

class TopicMastery(Base):
    __tablename__ = "topic_mastery"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=False)
    mastery_score = Column(Float, default=0.0)
    attempts = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    easiness_factor = Column(Float, default=2.5)     # SM-2
    interval_days = Column(Integer, default=1)       # SM-2
    repetition_count = Column(Integer, default=0)   # SM-2
    last_reviewed = Column(DateTime)
    next_review = Column(DateTime)
    misconceptions = Column(ARRAY(String), default=[])
    
    user = relationship("User", back_populates="topic_masteries")
    concept = relationship("Concept", back_populates="masteries")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=False)
    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    student_answer = Column(Text)
    is_correct = Column(Boolean)
    quality_score = Column(Integer)   # 0-5, for SM-2
    misconception_tag = Column(String(255))
    time_taken_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="quiz_attempts")


class InteractionEvent(Base):
    __tablename__ = "interaction_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"))
    event_type = Column(String(100))   # hesitation, hint_request, backtrack, etc.
    duration_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(50))      # user or assistant
    content = Column(Text)
    context_concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="chat_messages")
```

---

### FILE: backend/app/main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, documents, quiz, chat, analytics, mindmap
from app.database import Base, engine

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ACLS – Adaptive Cognitive Learning System",
    description="AI-powered personalized learning platform",
    version="1.0.0"
)

# CORS – allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(mindmap.router, prefix="/api/mindmap", tags=["Mind Map"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

---

### FILE: backend/app/utils/sm2.py

```python
"""
SuperMemo 2 (SM-2) Spaced Repetition Algorithm
Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Tuple


@dataclass
class SM2State:
    interval: int = 1        # days until next review
    ef: float = 2.5          # easiness factor (min 1.3)
    repetitions: int = 0     # consecutive correct reviews


def sm2_update(state: SM2State, quality: int) -> Tuple[SM2State, datetime]:
    """
    Update SM-2 state based on review quality.
    
    Args:
        state: Current SM-2 state for this concept
        quality: Integer 0-5
            5: Perfect response
            4: Correct with slight hesitation
            3: Correct with significant difficulty
            2: Incorrect but correct answer felt easy to recall
            1: Incorrect but correct answer felt hard to recall
            0: Complete memory blackout
    
    Returns:
        (new_state, next_review_datetime)
    """
    if not 0 <= quality <= 5:
        raise ValueError(f"Quality must be 0-5, got {quality}")
    
    new_state = SM2State(state.interval, state.ef, state.repetitions)
    
    if quality >= 3:
        # Correct response: advance interval
        if state.repetitions == 0:
            new_state.interval = 1
        elif state.repetitions == 1:
            new_state.interval = 6
        else:
            new_state.interval = round(state.interval * state.ef)
        new_state.repetitions = state.repetitions + 1
    else:
        # Incorrect response: reset
        new_state.repetitions = 0
        new_state.interval = 1
    
    # Update easiness factor
    new_state.ef = state.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_state.ef = max(new_state.ef, 1.3)   # EF never drops below 1.3
    
    next_review = datetime.utcnow() + timedelta(days=new_state.interval)
    return new_state, next_review


def quality_from_performance(is_correct: bool, time_taken_ms: int, hint_used: bool) -> int:
    """
    Compute SM-2 quality score (0-5) from raw performance data.
    """
    if not is_correct:
        if hint_used:
            return 1   # Wrong + needed hint = very hard recall
        return 2       # Wrong without hint = could recall after seeing answer
    
    # Correct answer: determine quality by time and hint usage
    if hint_used:
        return 3       # Correct but needed help
    
    if time_taken_ms < 5000:    # Under 5 seconds
        return 5       # Perfect
    elif time_taken_ms < 15000: # 5-15 seconds
        return 4       # Good
    else:
        return 3       # Correct but slow
```

---

### FILE: backend/app/utils/pdf_parser.py

```python
"""
PDF text extraction using PyMuPDF (fitz).
Extracts text with heading detection based on font size.
"""
import fitz   # PyMuPDF
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class TextChunk:
    text: str
    page_number: int
    heading: Optional[str] = None
    chunk_index: int = 0
    font_sizes: List[float] = field(default_factory=list)


def extract_chunks_from_pdf(file_path: str, max_chunk_tokens: int = 400) -> List[TextChunk]:
    """
    Extract semantic chunks from a PDF file.
    Uses heading detection (font size > average) to split at logical boundaries.
    """
    doc = fitz.open(file_path)
    all_blocks = []
    
    # Pass 1: Collect all text blocks with font size info
    for page_num, page in enumerate(doc, start=1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block.get("type") != 0:   # 0 = text block
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span["text"].strip():
                        all_blocks.append({
                            "text": span["text"].strip(),
                            "size": span["size"],
                            "page": page_num,
                            "bold": "Bold" in span.get("font", "")
                        })
    
    if not all_blocks:
        return []
    
    # Compute average font size to detect headings
    avg_size = sum(b["size"] for b in all_blocks) / len(all_blocks)
    heading_threshold = avg_size * 1.15   # 15% bigger = heading
    
    # Pass 2: Build chunks split at headings
    chunks = []
    current_chunk_text = []
    current_heading = None
    current_page = 1
    chunk_index = 0
    
    for block in all_blocks:
        is_heading = block["size"] >= heading_threshold or (block["bold"] and len(block["text"]) < 80)
        
        if is_heading and current_chunk_text:
            # Save current chunk
            chunks.append(TextChunk(
                text=" ".join(current_chunk_text),
                page_number=current_page,
                heading=current_heading,
                chunk_index=chunk_index
            ))
            chunk_index += 1
            current_chunk_text = []
        
        if is_heading:
            current_heading = block["text"]
        else:
            current_chunk_text.append(block["text"])
        
        current_page = block["page"]
    
    # Final chunk
    if current_chunk_text:
        chunks.append(TextChunk(
            text=" ".join(current_chunk_text),
            page_number=current_page,
            heading=current_heading,
            chunk_index=chunk_index
        ))
    
    doc.close()
    
    # Split oversized chunks
    final_chunks = []
    for chunk in chunks:
        words = chunk.text.split()
        if len(words) > max_chunk_tokens:
            # Split at sentence boundary every ~max_chunk_tokens words
            sentences = chunk.text.replace(". ", ".|").replace("? ", "?|").replace("! ", "!|").split("|")
            sub_chunk = []
            sub_words = 0
            sub_idx = 0
            for sentence in sentences:
                sub_words += len(sentence.split())
                sub_chunk.append(sentence)
                if sub_words >= max_chunk_tokens:
                    final_chunks.append(TextChunk(
                        text=" ".join(sub_chunk),
                        page_number=chunk.page_number,
                        heading=chunk.heading,
                        chunk_index=chunk.chunk_index + sub_idx / 100
                    ))
                    sub_chunk = []
                    sub_words = 0
                    sub_idx += 1
            if sub_chunk:
                final_chunks.append(TextChunk(
                    text=" ".join(sub_chunk),
                    page_number=chunk.page_number,
                    heading=chunk.heading,
                    chunk_index=chunk.chunk_index + sub_idx / 100
                ))
        else:
            final_chunks.append(chunk)
    
    return final_chunks
```

---

### FILE: backend/app/engines/context_engine.py

```python
"""
Context & Knowledge Graph Engine
Handles: document processing, topic extraction, knowledge graph construction
"""
import json
import uuid
from typing import List, Dict, Optional
import networkx as nx
import chromadb
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document, Concept, ConceptPrerequisite
from app.utils.pdf_parser import extract_chunks_from_pdf, TextChunk

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PATH)


def process_document(document_id: str, db: Session) -> None:
    """
    Main entry point. Runs as a background Celery task.
    1. Parse PDF → chunks
    2. Extract topics from each chunk via LLM
    3. Create embeddings and store in ChromaDB
    4. Build knowledge graph with prerequisite edges
    5. Save everything to PostgreSQL
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return
    
    doc.status = "processing"
    db.commit()
    
    try:
        # Step 1: Parse PDF
        chunks = extract_chunks_from_pdf(doc.file_path)
        
        # Step 2 & 3: Extract topics + embeddings for each chunk
        concepts_data = []
        for chunk in chunks:
            topics = _extract_topics_from_chunk(chunk.text)
            
            for topic_info in topics:
                # Generate embedding
                embedding = _get_embedding(topic_info["primary_topic"] + " " + chunk.text[:200])
                
                # Store in ChromaDB
                collection = _get_or_create_collection(str(document_id))
                embedding_id = str(uuid.uuid4())
                collection.add(
                    ids=[embedding_id],
                    embeddings=[embedding],
                    documents=[chunk.text],
                    metadatas=[{
                        "page_number": chunk.page_number,
                        "heading": chunk.heading or "",
                        "topic": topic_info["primary_topic"]
                    }]
                )
                
                concepts_data.append({
                    "name": topic_info["primary_topic"],
                    "subtopics": topic_info.get("subtopics", []),
                    "prerequisites": topic_info.get("prerequisites", []),
                    "chunk_text": chunk.text,
                    "page_number": chunk.page_number,
                    "embedding_id": embedding_id
                })
        
        # Step 4: Save concepts to DB
        concept_objects = {}
        for cdata in concepts_data:
            concept = Concept(
                document_id=document_id,
                name=cdata["name"],
                chunk_text=cdata["chunk_text"],
                page_number=cdata["page_number"],
                embedding_id=cdata["embedding_id"]
            )
            db.add(concept)
            db.flush()   # get ID without committing
            concept_objects[cdata["name"].lower()] = concept
        
        db.commit()
        
        # Step 5: Build prerequisite edges
        for cdata in concepts_data:
            concept = concept_objects.get(cdata["name"].lower())
            if not concept:
                continue
            
            for prereq_name in cdata["prerequisites"]:
                prereq = concept_objects.get(prereq_name.lower())
                if prereq and prereq.id != concept.id:
                    edge = ConceptPrerequisite(
                        concept_id=concept.id,
                        prerequisite_id=prereq.id,
                        source="llm"
                    )
                    db.merge(edge)   # merge avoids duplicate primary key error
        
        db.commit()
        
        doc.status = "complete"
        db.commit()
    
    except Exception as e:
        doc.status = "failed"
        db.commit()
        raise e


def _extract_topics_from_chunk(chunk_text: str) -> List[Dict]:
    """
    Use GPT-4o to extract structured topic data from a text chunk.
    Returns list of topic dicts.
    """
    prompt = f"""You are an educational content analyzer. Given the following text chunk from a study document, extract topic information.

Text:
{chunk_text[:2000]}

Return a JSON array (no markdown) where each object has:
- "primary_topic": string (1-4 words, the main concept)
- "subtopics": array of strings (key terms or sub-concepts, max 5)  
- "prerequisites": array of strings (concepts students must already know, max 3)

Be specific and concise. Focus on the most important concept in this chunk.
If the text is too short or not educational, return an empty array [].
"""
    
    response = openai_client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=500
    )
    
    content = response.choices[0].message.content.strip()
    # Strip markdown code blocks if present
    content = content.replace("```json", "").replace("```", "").strip()
    
    try:
        result = json.loads(content)
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError:
        return []


def _get_embedding(text: str) -> List[float]:
    """Generate text embedding using OpenAI."""
    response = openai_client.embeddings.create(
        input=text[:8000],   # token limit
        model=settings.OPENAI_EMBEDDING_MODEL
    )
    return response.data[0].embedding


def _get_or_create_collection(document_id: str):
    """Get or create a ChromaDB collection for a document."""
    try:
        return chroma_client.get_collection(f"doc_{document_id}")
    except Exception:
        return chroma_client.create_collection(
            name=f"doc_{document_id}",
            metadata={"hnsw:space": "cosine"}
        )


def get_knowledge_graph(document_id: str, db: Session) -> Dict:
    """
    Build and return the knowledge graph as a JSON structure for visualization.
    """
    concepts = db.query(Concept).filter(Concept.document_id == document_id).all()
    prereqs = db.query(ConceptPrerequisite).filter(
        ConceptPrerequisite.concept_id.in_([c.id for c in concepts])
    ).all()
    
    nodes = [{"id": str(c.id), "label": c.name, "page": c.page_number} for c in concepts]
    edges = [{"source": str(p.prerequisite_id), "target": str(p.concept_id)} for p in prereqs]
    
    return {"nodes": nodes, "edges": edges}


def semantic_search(query: str, document_id: str, top_k: int = 5) -> List[Dict]:
    """Search for relevant content chunks using semantic similarity."""
    query_embedding = _get_embedding(query)
    
    try:
        collection = chroma_client.get_collection(f"doc_{document_id}")
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        
        chunks = []
        for i, doc_text in enumerate(results["documents"][0]):
            chunks.append({
                "text": doc_text,
                "page": results["metadatas"][0][i].get("page_number"),
                "topic": results["metadatas"][0][i].get("topic"),
                "similarity": 1 - results["distances"][0][i]
            })
        return chunks
    except Exception:
        return []
```

---

### FILE: backend/app/engines/student_model.py

```python
"""
Student Modeling Engine
Manages mastery scores, misconception detection, SM-2 updates
"""
import math
from datetime import datetime
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from openai import OpenAI

from app.config import settings
from app.models.student_profile import TopicMastery, QuizAttempt, InteractionEvent
from app.utils.sm2 import sm2_update, SM2State, quality_from_performance

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def get_or_create_mastery(user_id: str, concept_id: str, db: Session) -> TopicMastery:
    """Get existing mastery record or create default one."""
    mastery = db.query(TopicMastery).filter(
        TopicMastery.user_id == user_id,
        TopicMastery.concept_id == concept_id
    ).first()
    
    if not mastery:
        mastery = TopicMastery(
            user_id=user_id,
            concept_id=concept_id,
            mastery_score=0.0,
            attempts=0,
            correct=0,
            easiness_factor=2.5,
            interval_days=1,
            repetition_count=0,
            misconceptions=[]
        )
        db.add(mastery)
        db.commit()
    
    return mastery


def update_after_quiz(
    user_id: str,
    concept_id: str,
    is_correct: bool,
    student_answer: str,
    correct_answer: str,
    question: str,
    time_taken_ms: int,
    hint_used: bool,
    db: Session
) -> Dict:
    """
    Full update cycle after a quiz question:
    1. Detect misconception if wrong
    2. Update SM-2 scheduling
    3. Recompute mastery score
    4. Save quiz attempt
    """
    mastery = get_or_create_mastery(user_id, concept_id, db)
    
    # Step 1: Detect misconception
    misconception = None
    if not is_correct:
        misconception = detect_misconception(question, correct_answer, student_answer)
        if misconception and misconception not in (mastery.misconceptions or []):
            mastery.misconceptions = (mastery.misconceptions or []) + [misconception]
    
    # Step 2: SM-2 update
    quality = quality_from_performance(is_correct, time_taken_ms, hint_used)
    sm2_state = SM2State(
        interval=mastery.interval_days,
        ef=mastery.easiness_factor,
        repetitions=mastery.repetition_count
    )
    new_state, next_review = sm2_update(sm2_state, quality)
    
    mastery.interval_days = new_state.interval
    mastery.easiness_factor = new_state.ef
    mastery.repetition_count = new_state.repetitions
    mastery.last_reviewed = datetime.utcnow()
    mastery.next_review = next_review
    
    # Step 3: Update raw counts
    mastery.attempts = (mastery.attempts or 0) + 1
    if is_correct:
        mastery.correct = (mastery.correct or 0) + 1
    
    # Step 4: Recompute mastery score
    mastery.mastery_score = compute_mastery_score(mastery)
    
    db.commit()
    
    # Step 5: Save quiz attempt record
    attempt = QuizAttempt(
        user_id=user_id,
        concept_id=concept_id,
        question=question,
        correct_answer=correct_answer,
        student_answer=student_answer,
        is_correct=is_correct,
        quality_score=quality,
        misconception_tag=misconception,
        time_taken_ms=time_taken_ms
    )
    db.add(attempt)
    db.commit()
    
    return {
        "mastery_score": mastery.mastery_score,
        "next_review": next_review.isoformat(),
        "misconception": misconception,
        "quality_score": quality
    }


def compute_mastery_score(mastery: TopicMastery) -> float:
    """
    Compute mastery score using:
    - Accuracy (correct / attempts)
    - Confidence (grows with more attempts)
    - Exponential decay on old attempts (recent attempts weighted more)
    """
    if not mastery.attempts:
        return 0.0
    
    raw_accuracy = (mastery.correct or 0) / mastery.attempts
    
    # Confidence factor: saturates toward 1.0 after ~20 attempts
    confidence = 1 - (1 / (1 + mastery.attempts * 0.5))
    
    # Recency weight: if not reviewed recently, score decays
    recency_weight = 1.0
    if mastery.last_reviewed:
        days_since = (datetime.utcnow() - mastery.last_reviewed).days
        decay_rate = 0.05
        recency_weight = math.exp(-decay_rate * days_since)
    
    return raw_accuracy * confidence * recency_weight


def detect_misconception(question: str, correct_answer: str, student_answer: str) -> Optional[str]:
    """Use LLM to identify the specific misconception behind a wrong answer."""
    if not student_answer:
        return "no attempt / blank answer"
    
    prompt = f"""A student answered an educational question incorrectly.

Question: {question}
Correct Answer: {correct_answer}
Student's Answer: {student_answer}

In ONE sentence (max 15 words), identify the specific misconception or error type.
Be precise. Examples: "confused sine and cosine derivatives", "applied power rule to a product"
Do not judge the student, just name the error type."""
    
    try:
        response = openai_client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=60
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return None


def get_student_profile(user_id: str, db: Session) -> Dict:
    """Build a complete student profile dict for use by other engines."""
    masteries = db.query(TopicMastery).filter(TopicMastery.user_id == user_id).all()
    
    topic_mastery_data = {}
    weak_concepts = []
    mastered_concepts = []
    
    for m in masteries:
        topic_mastery_data[str(m.concept_id)] = {
            "score": m.mastery_score,
            "attempts": m.attempts,
            "correct": m.correct,
            "next_review": m.next_review.isoformat() if m.next_review else None,
            "misconceptions": m.misconceptions or []
        }
        if m.mastery_score < 0.5:
            weak_concepts.append(str(m.concept_id))
        elif m.mastery_score >= 0.8:
            mastered_concepts.append(str(m.concept_id))
    
    return {
        "user_id": str(user_id),
        "topic_mastery": topic_mastery_data,
        "weak_concepts": weak_concepts,
        "mastered_concepts": mastered_concepts
    }
```

---

### FILE: backend/app/engines/adaptive_engine.py

```python
"""
Adaptive Learning Engine
Decides what the student should do next.
"""
from datetime import datetime
from typing import List, Dict, Optional
import networkx as nx
from sqlalchemy.orm import Session

from app.models.document import Concept, ConceptPrerequisite
from app.models.student_profile import TopicMastery


def build_graph(document_id: str, db: Session) -> nx.DiGraph:
    """Build an in-memory NetworkX graph from DB data."""
    concepts = db.query(Concept).filter(Concept.document_id == document_id).all()
    prereqs = db.query(ConceptPrerequisite).filter(
        ConceptPrerequisite.concept_id.in_([c.id for c in concepts])
    ).all()
    
    G = nx.DiGraph()
    for c in concepts:
        G.add_node(str(c.id), name=c.name)
    for p in prereqs:
        G.add_edge(str(p.prerequisite_id), str(p.concept_id))
    
    return G


def recommend_next_topic(user_id: str, document_id: str, db: Session) -> Optional[Dict]:
    """
    Score all concepts and return the one with highest priority.
    Factors:
      1. Spaced repetition urgency (overdue reviews score higher)
      2. Low mastery (needs work)
      3. Prerequisites satisfied (prerequisite mastery >= 0.6)
      4. Not just studied (avoid immediate repetition)
    """
    G = build_graph(document_id, db)
    concepts = db.query(Concept).filter(Concept.document_id == document_id).all()
    masteries = {
        str(m.concept_id): m
        for m in db.query(TopicMastery).filter(TopicMastery.user_id == user_id).all()
    }
    
    scores = {}
    now = datetime.utcnow()
    
    for concept in concepts:
        cid = str(concept.id)
        mastery = masteries.get(cid)
        mastery_score = mastery.mastery_score if mastery else 0.0
        score = 0.0
        
        # Factor 1: Spaced repetition urgency
        if mastery and mastery.next_review:
            days_overdue = (now - mastery.next_review).days
            if days_overdue > 0:
                score += min(days_overdue * 0.3, 3.0)
        elif not mastery:
            score += 1.0   # Never studied = high priority
        
        # Factor 2: Mastery gap
        score += (1.0 - mastery_score) * 2.0
        
        # Factor 3: Prerequisite readiness
        prereq_ids = list(G.predecessors(cid))
        if prereq_ids:
            prereq_masteries = [masteries.get(pid) for pid in prereq_ids]
            prereq_scores = [
                m.mastery_score if m else 0.0
                for m in prereq_masteries
            ]
            avg_prereq_mastery = sum(prereq_scores) / len(prereq_scores)
            if avg_prereq_mastery < 0.5:
                score -= 4.0   # Heavily penalize: foundations not ready
        
        scores[cid] = score
    
    if not scores:
        return None
    
    best_cid = max(scores, key=scores.get)
    best_concept = next(c for c in concepts if str(c.id) == best_cid)
    
    # Check if prerequisite redirect is needed
    redirect = check_prerequisite_redirect(user_id, best_cid, G, masteries, concepts)
    if redirect:
        return redirect
    
    return {
        "concept_id": best_cid,
        "concept_name": best_concept.name,
        "score": scores[best_cid],
        "mastery": masteries.get(best_cid, None) and masteries[best_cid].mastery_score or 0.0,
        "redirect": False
    }


def check_prerequisite_redirect(user_id, concept_id, G, masteries, concepts) -> Optional[Dict]:
    """
    If the student is failing a concept because of weak prerequisites,
    redirect them to study the prerequisite first.
    """
    mastery = masteries.get(concept_id)
    if not mastery or mastery.attempts < 3:
        return None   # Not enough data to judge
    
    if mastery.mastery_score > 0.4:
        return None   # Doing okay, no redirect needed
    
    # Find weakest prerequisite
    prereq_ids = list(G.predecessors(concept_id))
    for prereq_id in prereq_ids:
        prereq_mastery = masteries.get(prereq_id)
        prereq_score = prereq_mastery.mastery_score if prereq_mastery else 0.0
        
        if prereq_score < 0.5:
            prereq_concept = next((c for c in concepts if str(c.id) == prereq_id), None)
            if prereq_concept:
                return {
                    "concept_id": prereq_id,
                    "concept_name": prereq_concept.name,
                    "redirect": True,
                    "redirect_message": (
                        f"You're struggling here because '{prereq_concept.name}' "
                        f"needs more work first. Let's fix that foundation."
                    )
                }
    return None


def generate_learning_path(user_id: str, target_concept_id: str, document_id: str, db: Session) -> List[Dict]:
    """
    Generate an ordered study path to reach a target concept.
    Uses topological sort on the prerequisite graph.
    Filters out already-mastered concepts.
    """
    G = build_graph(document_id, db)
    concepts = {str(c.id): c for c in db.query(Concept).filter(Concept.document_id == document_id).all()}
    masteries = {
        str(m.concept_id): m.mastery_score
        for m in db.query(TopicMastery).filter(TopicMastery.user_id == user_id).all()
    }
    
    if target_concept_id not in G:
        return []
    
    # Get all ancestors of target
    ancestors = nx.ancestors(G, target_concept_id)
    subgraph = G.subgraph(ancestors | {target_concept_id})
    
    try:
        path = list(nx.topological_sort(subgraph))
    except nx.NetworkXUnfeasible:
        path = list(ancestors) + [target_concept_id]
    
    result = []
    for cid in path:
        mastery = masteries.get(cid, 0.0)
        if mastery < 0.75:   # Only include concepts not yet mastered
            concept = concepts.get(cid)
            if concept:
                result.append({
                    "concept_id": cid,
                    "concept_name": concept.name,
                    "mastery": mastery,
                    "status": "weak" if mastery < 0.4 else "partial"
                })
    
    return result
```

---

### FILE: backend/app/engines/generative_engine.py

```python
"""
Generative Pedagogy Engine
Generates: flashcards, quizzes, Socratic questions, hints, summaries
"""
import json
from typing import List, Dict, Optional
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Concept
from app.models.student_profile import TopicMastery
from app.engines.context_engine import semantic_search

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def _call_llm(prompt: str, max_tokens: int = 1000) -> str:
    """Generic LLM call wrapper."""
    response = openai_client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=max_tokens
    )
    return response.choices[0].message.content.strip()


def generate_flashcards(
    user_id: str,
    concept_id: str,
    document_id: str,
    count: int,
    db: Session
) -> List[Dict]:
    """
    Generate flashcards targeting a student's weak areas for a concept.
    """
    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    mastery = db.query(TopicMastery).filter(
        TopicMastery.user_id == user_id,
        TopicMastery.concept_id == concept_id
    ).first()
    
    mastery_score = mastery.mastery_score if mastery else 0.0
    misconceptions = mastery.misconceptions if mastery else []
    
    if mastery_score < 0.4:
        difficulty = "beginner (definitions, basic understanding)"
    elif mastery_score < 0.7:
        difficulty = "intermediate (application and worked examples)"
    else:
        difficulty = "advanced (edge cases, synthesis, tricky scenarios)"
    
    # Get relevant context from the document
    context_chunks = semantic_search(concept.name, str(document_id), top_k=3)
    context_text = "\n\n".join([c["text"] for c in context_chunks])[:2000]
    
    misconception_instruction = ""
    if misconceptions:
        misconception_instruction = f"\nKnown misconceptions to target:\n" + "\n".join(f"- {m}" for m in misconceptions)
    
    prompt = f"""You are an expert tutor. Generate exactly {count} flashcards for the concept: "{concept.name}"

Difficulty level: {difficulty}
{misconception_instruction}

Source material:
{context_text}

Rules:
- Each flashcard should test a single, specific idea
- "front" = a clear question or prompt
- "back" = a concise, complete answer (1-3 sentences)
- If misconceptions are listed, create at least one card that directly addresses each one

Return ONLY a JSON array, no markdown, no extra text:
[{{"front": "...", "back": "..."}}, ...]"""
    
    raw = _call_llm(prompt, max_tokens=1500)
    raw = raw.replace("```json", "").replace("```", "").strip()
    
    try:
        cards = json.loads(raw)
        return cards[:count]
    except json.JSONDecodeError:
        return [{"front": f"Define: {concept.name}", "back": concept.chunk_text[:200] if concept.chunk_text else "See your notes."}]


def generate_quiz_question(
    concept_id: str,
    document_id: str,
    mastery_score: float,
    misconceptions: List[str],
    db: Session
) -> Dict:
    """
    Generate a single multiple-choice question with targeted difficulty.
    """
    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    context_chunks = semantic_search(concept.name, str(document_id), top_k=2)
    context_text = "\n\n".join([c["text"] for c in context_chunks])[:1500]
    
    if mastery_score < 0.35:
        difficulty = "easy – test basic recall of definitions"
    elif mastery_score < 0.65:
        difficulty = "medium – test understanding and application"
    else:
        difficulty = "hard – test synthesis, edge cases, or nuanced understanding"
    
    misconception_text = ""
    if misconceptions:
        misconception_text = f"\nMake distractors (wrong options) reflect these known misconceptions:\n" + "\n".join(f"- {m}" for m in misconceptions[:3])
    
    prompt = f"""Generate one multiple-choice question about "{concept.name}".

Difficulty: {difficulty}
{misconception_text}

Context from student's notes:
{context_text}

Return ONLY JSON (no markdown):
{{
  "question": "...",
  "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
  "correct": "A",
  "explanation": "...",
  "misconception_tested": "..."
}}

Rules:
- One clearly correct answer
- Three plausible but wrong distractors
- Explanation should explain WHY the correct answer is right and the others are wrong"""
    
    raw = _call_llm(prompt, max_tokens=600)
    raw = raw.replace("```json", "").replace("```", "").strip()
    
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "question": f"What is the main concept of {concept.name}?",
            "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
            "correct": "A",
            "explanation": "See your notes.",
            "misconception_tested": ""
        }


def generate_hint(
    question: str,
    correct_answer: str,
    student_answer: str,
    hint_level: int,
    concept_name: str
) -> str:
    """
    Generate a progressive hint. hint_level 1-4:
    1 = conceptual nudge only
    2 = identify which sub-skill is needed
    3 = first step without completing
    4 = full worked explanation
    """
    level_instructions = {
        1: "Give ONLY a conceptual nudge. Point to the right area of thinking. Do NOT give any part of the answer.",
        2: "Identify which specific skill or sub-concept is needed. Still don't give the answer.",
        3: "Show or describe the FIRST STEP only. Do not complete the solution.",
        4: "Give a full, clear explanation with the complete worked answer."
    }
    
    instruction = level_instructions.get(hint_level, level_instructions[2])
    
    prompt = f"""You are a patient tutor helping a student who got this wrong.

Concept: {concept_name}
Question: {question}
Correct Answer: {correct_answer}
Student's Wrong Answer: {student_answer or "(no answer given)"}
Hint Level: {hint_level}/4

Instruction for this hint level: {instruction}

Write the hint in 1-4 sentences. Be encouraging but do not just give the answer away (unless level 4)."""
    
    return _call_llm(prompt, max_tokens=200)


def generate_socratic_question(
    concept: str,
    student_response: str,
    correct_direction: str
) -> str:
    """Generate a Socratic question to guide student toward correct understanding."""
    prompt = f"""You are a Socratic tutor. A student is trying to understand: {concept}

Their current response: "{student_response}"
The correct direction: "{correct_direction}"

Generate ONE Socratic question that:
1. Does NOT reveal the answer
2. Points to a gap in their reasoning
3. Builds on what they said correctly
4. Is genuinely questioning, not a hint in disguise

Respond with just the question."""
    
    return _call_llm(prompt, max_tokens=100)


def generate_summary(
    concept_id: str,
    document_id: str,
    mastery_score: float,
    misconceptions: List[str],
    db: Session
) -> str:
    """Generate a personalized summary adapted to student level."""
    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    context_chunks = semantic_search(concept.name, str(document_id), top_k=4)
    context_text = "\n\n".join([c["text"] for c in context_chunks])[:2500]
    
    level = "beginner" if mastery_score < 0.4 else ("intermediate" if mastery_score < 0.7 else "advanced")
    misconception_focus = ""
    if misconceptions:
        misconception_focus = f"\nSpecially address these common confusions: {', '.join(misconceptions)}"
    
    prompt = f"""Summarize "{concept.name}" for a {level}-level student in under 250 words.

{misconception_focus}

Source material:
{context_text}

Write in clear, direct language. Use one brief example if helpful. 
Highlight what beginners most often get wrong. Do not use bullet points."""
    
    return _call_llm(prompt, max_tokens=400)
```

---

### FILE: backend/app/engines/analytics_engine.py

```python
"""
Analytics & Behavior Engine
Computes learning metrics and structures dashboard data.
"""
from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student_profile import TopicMastery, QuizAttempt, InteractionEvent
from app.models.document import Concept


def get_dashboard_data(user_id: str, db: Session) -> Dict:
    """
    Compile all analytics data for the student dashboard.
    """
    masteries = db.query(TopicMastery).filter(TopicMastery.user_id == user_id).all()
    concepts = {str(m.concept_id): m for m in masteries}
    
    total_concepts = len(masteries)
    avg_mastery = sum(m.mastery_score for m in masteries) / total_concepts if total_concepts else 0
    
    # Concepts due for review today
    now = datetime.utcnow()
    due_reviews = [m for m in masteries if m.next_review and m.next_review <= now]
    
    # Weak areas (mastery < 0.5)
    weak = sorted(
        [m for m in masteries if m.mastery_score < 0.5],
        key=lambda m: m.mastery_score
    )
    
    # Recent activity (last 7 days quiz counts per day)
    week_ago = now - timedelta(days=7)
    recent_attempts = db.query(
        func.date(QuizAttempt.created_at).label("date"),
        func.count(QuizAttempt.id).label("count"),
        func.sum(func.cast(QuizAttempt.is_correct, db.bind.dialect.name == 'postgresql' and 'integer' or 'int')).label("correct")
    ).filter(
        QuizAttempt.user_id == user_id,
        QuizAttempt.created_at >= week_ago
    ).group_by(func.date(QuizAttempt.created_at)).all()
    
    return {
        "overview": {
            "total_concepts": total_concepts,
            "avg_mastery": round(avg_mastery, 3),
            "due_for_review": len(due_reviews),
            "mastered_count": len([m for m in masteries if m.mastery_score >= 0.8])
        },
        "due_reviews": [
            {
                "concept_id": str(m.concept_id),
                "mastery_score": m.mastery_score,
                "days_overdue": (now - m.next_review).days if m.next_review else 0
            }
            for m in sorted(due_reviews, key=lambda m: m.next_review or now)[:10]
        ],
        "weak_areas": [
            {
                "concept_id": str(m.concept_id),
                "mastery_score": m.mastery_score,
                "attempts": m.attempts,
                "misconceptions": m.misconceptions or []
            }
            for m in weak[:10]
        ],
        "mastery_distribution": [
            {"concept_id": str(m.concept_id), "mastery_score": m.mastery_score}
            for m in masteries
        ],
        "recent_activity": [
            {"date": str(r.date), "total": r.count, "correct": r.correct or 0}
            for r in recent_attempts
        ]
    }


def compute_learning_velocity(user_id: str, concept_id: str, db: Session) -> float:
    """
    Compute how fast mastery is growing for a concept.
    Compares mastery 7 days ago vs now.
    """
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    
    recent = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == user_id,
        QuizAttempt.concept_id == concept_id,
        QuizAttempt.created_at >= week_ago
    ).all()
    
    if len(recent) < 2:
        return 0.0
    
    correct_rate = sum(1 for a in recent if a.is_correct) / len(recent)
    current_mastery = db.query(TopicMastery).filter(
        TopicMastery.user_id == user_id,
        TopicMastery.concept_id == concept_id
    ).first()
    
    if not current_mastery:
        return 0.0
    
    # Velocity = daily mastery gain estimate
    return (current_mastery.mastery_score * correct_rate) / 7
```

---

### FILE: backend/app/routers/auth.py

```python
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.database import get_db
from app.config import settings
from app.models.user import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class UserCreate(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


def create_access_token(data: dict) -> str:
    from datetime import datetime
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = pwd_context.hash(user_data.password)
    user = User(email=user_data.email, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
```

---

### FILE: backend/app/routers/documents.py

```python
import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.routers.auth import get_current_user
from app.engines.context_engine import process_document, get_knowledge_graph
from app.config import settings

router = APIRouter()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    file_id = str(uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}.pdf")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    doc = Document(
        user_id=current_user.id,
        title=file.filename.replace(".pdf", ""),
        filename=file.filename,
        file_path=file_path,
        status="pending"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Process in background
    background_tasks.add_task(process_document, str(doc.id), db)
    
    return {"document_id": str(doc.id), "status": "processing", "message": "Document uploaded successfully"}


@router.get("/{document_id}/status")
def get_status(document_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": doc.status}


@router.get("/{document_id}/graph")
def get_graph(document_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return get_knowledge_graph(document_id, db)


@router.get("/")
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return [{"id": str(d.id), "title": d.title, "status": d.status, "created_at": d.created_at} for d in docs]
```

---

### FILE: backend/app/routers/quiz.py

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.document import Concept
from app.models.student_profile import TopicMastery
from app.routers.auth import get_current_user
from app.engines.generative_engine import generate_quiz_question, generate_flashcards, generate_hint
from app.engines.student_model import update_after_quiz

router = APIRouter()


class QuizSubmission(BaseModel):
    concept_id: str
    question: str
    correct_answer: str
    student_answer: str
    time_taken_ms: int
    hint_used: bool = False


class HintRequest(BaseModel):
    question: str
    correct_answer: str
    student_answer: Optional[str] = None
    hint_level: int = 1
    concept_name: str


@router.post("/generate")
def generate_quiz(
    concept_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mastery = db.query(TopicMastery).filter(
        TopicMastery.user_id == current_user.id,
        TopicMastery.concept_id == concept_id
    ).first()
    
    mastery_score = mastery.mastery_score if mastery else 0.0
    misconceptions = mastery.misconceptions if mastery else []
    
    question = generate_quiz_question(concept_id, document_id, mastery_score, misconceptions, db)
    return question


@router.post("/submit")
def submit_quiz(
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_correct = submission.student_answer.strip().lower() == submission.correct_answer.strip().lower()
    
    result = update_after_quiz(
        user_id=str(current_user.id),
        concept_id=submission.concept_id,
        is_correct=is_correct,
        student_answer=submission.student_answer,
        correct_answer=submission.correct_answer,
        question=submission.question,
        time_taken_ms=submission.time_taken_ms,
        hint_used=submission.hint_used,
        db=db
    )
    
    return {
        "is_correct": is_correct,
        "new_mastery_score": result["mastery_score"],
        "next_review": result["next_review"],
        "misconception_detected": result["misconception"],
        "feedback": "Great job!" if is_correct else f"Not quite. {result.get('misconception', '')}"
    }


@router.post("/flashcards/generate")
def get_flashcards(
    concept_id: str,
    document_id: str,
    count: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cards = generate_flashcards(str(current_user.id), concept_id, document_id, count, db)
    return {"flashcards": cards}


@router.post("/hints/generate")
def get_hint(
    hint_req: HintRequest,
    current_user: User = Depends(get_current_user)
):
    hint = generate_hint(
        question=hint_req.question,
        correct_answer=hint_req.correct_answer,
        student_answer=hint_req.student_answer,
        hint_level=hint_req.hint_level,
        concept_name=hint_req.concept_name
    )
    return {"hint": hint, "level": hint_req.hint_level}
```

---

### FILE: backend/app/routers/chat.py

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from openai import OpenAI

from app.database import get_db
from app.models.user import User
from app.models.student_profile import ChatMessage
from app.routers.auth import get_current_user
from app.engines.context_engine import semantic_search
from app.engines.student_model import get_student_profile
from app.config import settings

router = APIRouter()
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


class ChatRequest(BaseModel):
    message: str
    document_id: str
    context_concept_id: Optional[str] = None
    conversation_history: List[dict] = []


@router.post("/message")
def chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Retrieve relevant chunks from student's documents
    chunks = semantic_search(req.message, req.document_id, top_k=4)
    context = "\n\n---\n\n".join([c["text"] for c in chunks])
    
    # Get student profile for personalization
    profile = get_student_profile(str(current_user.id), db)
    weak_topics = profile.get("weak_concepts", [])[:5]
    
    system_prompt = f"""You are ACLS, an adaptive AI tutor. 

You have access to this student's study notes. Always ground your answers in the provided context.

Student's current weak areas (adapt your explanations accordingly): {weak_topics}

Context from student's documents:
{context}

Guidelines:
- Be clear and concise
- Use examples from their notes when possible
- If they seem confused, offer to break it down further
- Mention related concepts they should review if relevant
- End complex explanations with a follow-up question to check understanding"""
    
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history
    for msg in req.conversation_history[-10:]:   # Last 10 messages only
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    messages.append({"role": "user", "content": req.message})
    
    response = openai_client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=800
    )
    
    reply = response.choices[0].message.content
    
    # Save to chat history
    db.add(ChatMessage(user_id=current_user.id, role="user", content=req.message))
    db.add(ChatMessage(user_id=current_user.id, role="assistant", content=reply))
    db.commit()
    
    return {
        "response": reply,
        "sources": [{"page": c["page"], "topic": c["topic"]} for c in chunks],
    }
```

---

### FILE: backend/app/routers/analytics.py

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.engines.analytics_engine import get_dashboard_data

router = APIRouter()


@router.get("/dashboard")
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_dashboard_data(str(current_user.id), db)
```

---

### FILE: backend/app/routers/mindmap.py

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.student_profile import TopicMastery
from app.routers.auth import get_current_user
from app.engines.context_engine import get_knowledge_graph

router = APIRouter()


@router.get("/{document_id}")
def get_mindmap(document_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    graph_data = get_knowledge_graph(document_id, db)
    
    # Overlay mastery scores onto nodes
    masteries = {
        str(m.concept_id): m.mastery_score
        for m in db.query(TopicMastery).filter(TopicMastery.user_id == current_user.id).all()
    }
    
    for node in graph_data["nodes"]:
        mastery = masteries.get(node["id"], 0.0)
        node["mastery"] = mastery
        node["color"] = _mastery_to_color(mastery)
    
    return graph_data


def _mastery_to_color(mastery: float) -> str:
    if mastery < 0.3:
        return "#ef4444"   # red
    elif mastery < 0.6:
        return "#f59e0b"   # amber
    elif mastery < 0.8:
        return "#3b82f6"   # blue
    return "#22c55e"       # green
```

---

## ═══════════════════════════════════════
## FRONTEND
## ═══════════════════════════════════════

---

### FILE: frontend/src/api/client.ts

```typescript
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("acls_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("acls_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;

// API functions
export const api = {
  // Auth
  login: (email: string, password: string) =>
    client.post("/api/auth/login", null, { params: { username: email, password } }),
  register: (email: string, password: string) =>
    client.post("/api/auth/register", { email, password }),

  // Documents
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return client.post("/api/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getDocuments: () => client.get("/api/documents/"),
  getDocumentStatus: (id: string) => client.get(`/api/documents/${id}/status`),
  getKnowledgeGraph: (docId: string) => client.get(`/api/documents/${docId}/graph`),

  // Quiz
  generateQuiz: (conceptId: string, documentId: string) =>
    client.post("/api/quiz/generate", null, { params: { concept_id: conceptId, document_id: documentId } }),
  submitQuiz: (data: object) => client.post("/api/quiz/submit", data),
  generateFlashcards: (conceptId: string, documentId: string, count = 5) =>
    client.post("/api/quiz/flashcards/generate", null, { params: { concept_id: conceptId, document_id: documentId, count } }),
  getHint: (data: object) => client.post("/api/quiz/hints/generate", data),

  // Chat
  sendMessage: (data: object) => client.post("/api/chat/message", data),

  // Analytics
  getDashboard: () => client.get("/api/analytics/dashboard"),

  // Mind Map
  getMindMap: (documentId: string) => client.get(`/api/mindmap/${documentId}`),

  // Student
  getNextTopic: (documentId: string) =>
    client.get("/api/student/next-topic", { params: { document_id: documentId } }),
};
```

---

### FILE: frontend/src/store/studyStore.ts

```typescript
import { create } from "zustand";
import { api } from "../api/client";

interface Concept {
  id: string;
  name: string;
  mastery?: number;
  color?: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface QuizQuestion {
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
}

interface StudyStore {
  currentDocumentId: string | null;
  currentConcept: Concept | null;
  flashcards: Flashcard[];
  currentQuiz: QuizQuestion | null;
  graphData: { nodes: any[]; edges: any[] } | null;
  isLoading: boolean;

  setDocument: (id: string) => void;
  setConcept: (concept: Concept) => void;
  fetchFlashcards: (conceptId: string, count?: number) => Promise<void>;
  fetchQuiz: (conceptId: string) => Promise<void>;
  fetchGraph: (documentId: string) => Promise<void>;
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  currentDocumentId: null,
  currentConcept: null,
  flashcards: [],
  currentQuiz: null,
  graphData: null,
  isLoading: false,

  setDocument: (id) => set({ currentDocumentId: id }),
  setConcept: (concept) => set({ currentConcept: concept }),

  fetchFlashcards: async (conceptId, count = 5) => {
    const { currentDocumentId } = get();
    if (!currentDocumentId) return;
    set({ isLoading: true });
    const res = await api.generateFlashcards(conceptId, currentDocumentId, count);
    set({ flashcards: res.data.flashcards, isLoading: false });
  },

  fetchQuiz: async (conceptId) => {
    const { currentDocumentId } = get();
    if (!currentDocumentId) return;
    set({ isLoading: true });
    const res = await api.generateQuiz(conceptId, currentDocumentId);
    set({ currentQuiz: res.data, isLoading: false });
  },

  fetchGraph: async (documentId) => {
    set({ isLoading: true });
    const res = await api.getMindMap(documentId);
    set({ graphData: res.data, isLoading: false });
  },
}));
```

---

### FILE: frontend/src/components/Flashcard.tsx

```tsx
import { useState } from "react";

interface FlashcardProps {
  front: string;
  back: string;
  onNext?: () => void;
}

export function Flashcard({ front, back, onNext }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
      {/* Card */}
      <div
        className="w-full min-h-48 rounded-2xl border border-gray-200 shadow-md cursor-pointer
                   bg-white flex items-center justify-center p-8 text-center
                   transition-all duration-300 hover:shadow-lg"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div>
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-widest">
            {isFlipped ? "Answer" : "Question"}
          </p>
          <p className="text-lg font-medium text-gray-800">
            {isFlipped ? back : front}
          </p>
          {!isFlipped && (
            <p className="text-sm text-gray-400 mt-4">Click to reveal</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsFlipped(false)}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
        >
          Reset
        </button>
        {onNext && (
          <button
            onClick={() => { setIsFlipped(false); onNext(); }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Next Card →
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### FILE: frontend/src/pages/Dashboard.tsx

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface DashboardData {
  overview: {
    total_concepts: number;
    avg_mastery: number;
    due_for_review: number;
    mastered_count: number;
  };
  due_reviews: any[];
  weak_areas: any[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.getDashboard().then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="p-8 text-gray-500">Loading dashboard...</div>;

  const { overview, due_reviews, weak_areas } = data;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Your Learning Dashboard</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Topics Studied", value: overview.total_concepts },
          { label: "Avg Mastery", value: `${Math.round(overview.avg_mastery * 100)}%` },
          { label: "Due for Review", value: overview.due_for_review, urgent: overview.due_for_review > 0 },
          { label: "Mastered", value: overview.mastered_count },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-4 ${card.urgent ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Due Reviews */}
      {due_reviews.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📅 Review Queue</h2>
          <div className="space-y-2">
            {due_reviews.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Concept {r.concept_id.slice(0, 8)}...</span>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                  {r.days_overdue} days overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak Areas */}
      {weak_areas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🎯 Focus Areas</h2>
          <div className="space-y-3">
            {weak_areas.slice(0, 5).map((w, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Concept {w.concept_id.slice(0, 8)}</span>
                  <span>{Math.round(w.mastery_score * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-red-400 h-2 rounded-full"
                    style={{ width: `${w.mastery_score * 100}%` }}
                  />
                </div>
                {w.misconceptions?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1 italic">
                    Common error: {w.misconceptions[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### FILE: docker-compose.yml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: acls
      POSTGRES_USER: acls_user
      POSTGRES_PASSWORD: acls_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U acls_user -d acls"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://acls_user:acls_pass@postgres:5432/acls
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - ./uploads:/app/uploads
      - ./chroma_db:/app/chroma_db
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      VITE_API_BASE_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

### FILE: backend/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### FILE: frontend/Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### FILE: backend/alembic.ini (partial)

```ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql://acls_user:acls_pass@localhost:5432/acls

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic
```

---

### FILE: frontend/package.json

```json
{
  "name": "acls-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "zustand": "^4.5.2",
    "axios": "^1.7.2",
    "recharts": "^2.12.7",
    "reactflow": "^11.11.4",
    "react-dropzone": "^14.2.3",
    "react-markdown": "^9.0.1",
    "@radix-ui/react-dialog": "^1.1.1",
    "tailwindcss": "^3.4.4"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.13",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```
