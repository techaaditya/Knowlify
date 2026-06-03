# Adaptive Cognitive Learning System (ACLS)
# Complete Technical Documentation

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Engine 1 – Context & Knowledge Graph Engine](#4-engine-1--context--knowledge-graph-engine)
5. [Engine 2 – Student Modeling Engine](#5-engine-2--student-modeling-engine)
6. [Engine 3 – Adaptive Learning Engine](#6-engine-3--adaptive-learning-engine)
7. [Engine 4 – Generative Pedagogy Engine](#7-engine-4--generative-pedagogy-engine)
8. [Engine 5 – Analytics & Behavior Engine](#8-engine-5--analytics--behavior-engine)
9. [API Reference](#9-api-reference)
10. [Database Schema](#10-database-schema)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Algorithms Deep Dive](#12-algorithms-deep-dive)
13. [Setup & Deployment](#13-setup--deployment)
14. [Testing Strategy](#14-testing-strategy)
15. [Glossary](#15-glossary)

---

## 1. SYSTEM OVERVIEW

### 1.1 What ACLS Is

The Adaptive Cognitive Learning System (ACLS) is a full-stack AI-powered educational platform. Its defining characteristic is not any single feature, but a **unified student model** that drives every response, recommendation, and piece of generated content. Every action a student takes feeds back into this model, making the system progressively smarter about that individual learner.

### 1.2 What Makes It Different From Regular Tutoring Apps

| Regular Learning App | ACLS |
|---|---|
| Same quiz for every student | Quiz tailored to each student's weak areas |
| Static content | Dynamically generated flashcards, hints, Socratic questions |
| No memory between sessions | Continuous learner profile updated in real time |
| No understanding of why a student fails | Misconception diagnosis at the concept level |
| Content in isolation | All materials connected in a prerequisite knowledge graph |

### 1.3 The Core Loop (How the System Thinks)

```
Student uploads content
       ↓
Context Engine builds a Knowledge Graph of topics + prerequisites
       ↓
Student takes quiz / interacts with content
       ↓
Student Model updates (mastery scores, errors, confusion signals)
       ↓
Adaptive Engine decides: What should this student do NEXT?
       ↓
Generative Engine creates tailored content (flashcard, hint, question)
       ↓
Student studies ← loop repeats
       ↓
Analytics Engine visualizes progress
```

### 1.4 The Five Engines

- **Engine 1 – Context & Knowledge Graph Engine**: Ingests PDFs, notes, slides. Extracts topics, builds concept dependency graph.
- **Engine 2 – Student Modeling Engine**: Tracks mastery per concept, misconceptions, interaction behavior.
- **Engine 3 – Adaptive Learning Engine**: Decides what content to show next using spaced repetition + prerequisite logic.
- **Engine 4 – Generative Pedagogy Engine**: Creates flashcards, Socratic questions, hints, summaries, mind maps.
- **Engine 5 – Analytics & Behavior Engine**: Dashboard with progress charts, weakness clusters, learning velocity.

---

## 2. TECHNOLOGY STACK

### 2.1 Backend

| Layer | Technology | Why |
|---|---|---|
| API Framework | FastAPI (Python) | Async, fast, auto-generates OpenAPI docs |
| LLM Integration | OpenAI GPT-4o / Anthropic Claude API | Content generation, misconception analysis |
| Embeddings | OpenAI text-embedding-3-small or sentence-transformers | Semantic similarity for topic matching |
| Vector Database | ChromaDB (local) or Pinecone (cloud) | Store and search concept embeddings |
| Relational DB | PostgreSQL | User profiles, quiz history, mastery scores |
| ORM | SQLAlchemy + Alembic | Database models and migrations |
| Graph Library | NetworkX | Build and query the knowledge graph |
| PDF Parsing | PyMuPDF (fitz) + pdfplumber | Extract text from PDFs |
| NLP | spaCy | Named entity recognition, sentence splitting |
| Task Queue | Celery + Redis | Background jobs (PDF processing, long generation) |
| Auth | JWT (python-jose) + bcrypt | Stateless authentication |

### 2.2 Frontend

| Layer | Technology | Why |
|---|---|---|
| Framework | React 18 + TypeScript | Component-based, type safety |
| State Management | Zustand | Lightweight, no boilerplate |
| Routing | React Router v6 | Client-side navigation |
| UI Components | shadcn/ui + Tailwind CSS | Beautiful, accessible components |
| Charts | Recharts | Analytics dashboard |
| Mind Map | React Flow | Interactive node-edge graph visualization |
| HTTP Client | Axios | API calls with interceptors |
| File Upload | react-dropzone | Drag-and-drop PDF upload |
| Markdown | react-markdown | Render AI-generated content |

### 2.3 Infrastructure

```
Local Dev:     Docker Compose (all services in containers)
Production:    Backend on Railway/Render, Frontend on Vercel
DB:            Supabase (managed PostgreSQL)
Vector Store:  Pinecone (managed) or ChromaDB (local)
File Storage:  Supabase Storage or AWS S3
```

---

## 3. PROJECT STRUCTURE

```
acls/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entry point
│   │   ├── config.py                  # Environment variables, settings
│   │   ├── database.py                # DB connection, session factory
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── concept.py
│   │   │   ├── student_profile.py
│   │   │   └── quiz_attempt.py
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── quiz.py
│   │   │   └── analytics.py
│   │   ├── engines/                   # Core AI engines
│   │   │   ├── context_engine.py      # PDF parsing, topic extraction, graph
│   │   │   ├── student_model.py       # Learner state management
│   │   │   ├── adaptive_engine.py     # Recommendation, spaced repetition
│   │   │   ├── generative_engine.py   # Flashcards, quizzes, hints
│   │   │   └── analytics_engine.py    # Progress computation
│   │   ├── routers/                   # FastAPI route handlers
│   │   │   ├── auth.py
│   │   │   ├── documents.py
│   │   │   ├── quiz.py
│   │   │   ├── chat.py
│   │   │   ├── analytics.py
│   │   │   └── mindmap.py
│   │   ├── services/                  # Business logic layer
│   │   │   ├── llm_service.py         # Wrapper for OpenAI / Anthropic
│   │   │   ├── embedding_service.py   # Vector embedding operations
│   │   │   └── graph_service.py       # Knowledge graph operations
│   │   └── utils/
│   │       ├── pdf_parser.py
│   │       ├── text_chunker.py
│   │       └── sm2.py                 # Spaced repetition algorithm
│   ├── migrations/                    # Alembic migration files
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Upload.tsx
│   │   │   ├── Study.tsx
│   │   │   ├── Quiz.tsx
│   │   │   ├── MindMap.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Chat.tsx
│   │   ├── components/
│   │   │   ├── Flashcard.tsx
│   │   │   ├── QuizCard.tsx
│   │   │   ├── MindMapViewer.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── ChatBubble.tsx
│   │   ├── store/
│   │   │   ├── userStore.ts
│   │   │   └── studyStore.ts
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## 4. ENGINE 1 – CONTEXT & KNOWLEDGE GRAPH ENGINE

### 4.1 Purpose

This engine is the **foundation** of ACLS. It answers: "What is the student studying, and how do these concepts relate to each other?" Without this, personalization is impossible.

### 4.2 What It Does (Step by Step)

**Step 1: Document Ingestion**

When a student uploads a PDF or pastes notes, the system:
1. Receives the file via the `/api/documents/upload` endpoint
2. Saves it to storage (disk or S3)
3. Kicks off a background task (Celery) to process it asynchronously
4. Returns a `document_id` to the frontend immediately (don't block the UI)

**Step 2: PDF Parsing**

The parser extracts text from PDFs using `PyMuPDF`:
```
Page 1: "Introduction to Calculus..."
Page 2: "Limits and Continuity..."
Page 3: "Derivatives – Definition..."
```

It also captures:
- **Page numbers** (for citation, navigation)
- **Headings** (detected via font size > average → these become topics)
- **Bold text** (likely key terms)
- **Paragraph boundaries**

**Step 3: Text Chunking**

Raw text is split into **semantic chunks** (not just by page). Each chunk is ~300–500 tokens. Chunking strategy:

```
Heading-based chunking:
  - Find all headings in document
  - Everything between Heading N and Heading N+1 is one chunk
  - If chunk > 500 tokens, split at paragraph boundary
```

Each chunk gets metadata: `{document_id, page_number, heading, chunk_index}`

**Step 4: Topic Extraction**

For each chunk, we send it to an LLM with a prompt like:

```
Given this educational text chunk, extract:
1. The primary topic (1-3 words)
2. Up to 5 subtopics / key concepts
3. Any topics this chapter REQUIRES the student to already understand

Text: {chunk_text}

Respond in JSON.
```

This produces structured data:
```json
{
  "primary_topic": "Derivatives",
  "subtopics": ["Chain Rule", "Product Rule", "Quotient Rule"],
  "prerequisites": ["Limits", "Functions"]
}
```

**Step 5: Embedding Generation**

Each topic and chunk gets an **embedding** – a high-dimensional vector (1536 dimensions) that represents its meaning. Topics with similar meanings will have vectors close to each other in vector space.

```python
embedding = openai.embeddings.create(
    input=topic_text,
    model="text-embedding-3-small"
).data[0].embedding
```

These embeddings are stored in ChromaDB/Pinecone and used for:
- Semantic search ("find content similar to what the student is struggling with")
- Cross-document topic deduplication

**Step 6: Knowledge Graph Construction**

Using NetworkX, we build a directed graph where:
- **Nodes** = concepts/topics
- **Edges** = prerequisite relationships (A → B means "you need A before B")

```python
import networkx as nx

G = nx.DiGraph()
G.add_node("Limits", weight=0.0)      # weight = mastery score
G.add_node("Derivatives", weight=0.0)
G.add_node("Integrals", weight=0.0)
G.add_edge("Limits", "Derivatives")   # Limits is prerequisite for Derivatives
G.add_edge("Derivatives", "Integrals")
```

The graph is persisted to PostgreSQL (nodes table + edges table).

### 4.3 Prerequisite Detection Logic

We use two methods to determine prerequisite relationships:

**Method A – LLM-based**: The extraction prompt above explicitly asks "what does this require?"

**Method B – Topological order of document**: If Chapter 2 introduces limits and Chapter 4 introduces derivatives, we infer Chapter 2's topics are likely prerequisites for Chapter 4. This is a heuristic but very effective for well-structured textbooks.

**Method C – Embedding similarity + co-occurrence**: If "limits" appears frequently in the derivatives section, it's likely a prerequisite.

### 4.4 Data Model

```sql
-- concepts table
CREATE TABLE concepts (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    name VARCHAR(255) NOT NULL,
    embedding VECTOR(1536),   -- pgvector extension
    chunk_text TEXT,
    page_number INTEGER,
    created_at TIMESTAMP
);

-- concept_prerequisites table
CREATE TABLE concept_prerequisites (
    concept_id UUID REFERENCES concepts(id),
    prerequisite_id UUID REFERENCES concepts(id),
    confidence FLOAT DEFAULT 1.0,   -- how confident we are in this relationship
    PRIMARY KEY (concept_id, prerequisite_id)
);
```

### 4.5 APIs

| Endpoint | Method | Description |
|---|---|---|
| `/api/documents/upload` | POST | Upload PDF or text |
| `/api/documents/{id}/status` | GET | Check processing status |
| `/api/documents/{id}/concepts` | GET | List all extracted concepts |
| `/api/documents/{id}/graph` | GET | Return graph JSON for visualization |
| `/api/concepts/{id}/prerequisites` | GET | Get prerequisites of a concept |

---

## 5. ENGINE 2 – STUDENT MODELING ENGINE

### 5.1 Purpose

The Student Model is the **brain's memory**. It answers: "What does this specific student know, where are they struggling, and how do they behave while learning?"

### 5.2 The Student Profile Schema

```json
{
  "user_id": "uuid",
  "topic_mastery": {
    "Limits": {
      "score": 0.72,           // 0.0 to 1.0
      "attempts": 14,
      "correct": 10,
      "last_reviewed": "2025-04-10",
      "next_review": "2025-04-15",   // SM-2 scheduled
      "easiness_factor": 2.3,        // SM-2 parameter
      "interval_days": 5,            // SM-2 parameter
      "misconceptions": ["confuses limit notation with value"]
    },
    "Derivatives": {
      "score": 0.45,
      "attempts": 8,
      "correct": 3,
      ...
    }
  },
  "interaction_signals": {
    "avg_response_time_ms": 4200,
    "hesitation_events": 12,         // paused > 30s before answering
    "backtrack_count": 5,            // went back to previous topic
    "session_count": 8
  },
  "learning_style": {
    "preferred_format": "visual",    // inferred from usage patterns
    "session_length_avg_min": 25
  },
  "weak_concepts": ["Chain Rule", "Quotient Rule"],
  "mastered_concepts": ["Functions", "Basic Algebra"]
}
```

### 5.3 Mastery Score Calculation

The mastery score for a concept is computed as:

```
mastery_score = (correct_answers / total_attempts) * recency_weight * confidence_weight

recency_weight = exponential_decay(days_since_last_attempt)
  → Recent attempts count more than old ones
  → decay_rate = 0.1 (configurable)

confidence_weight = 1 - (1 / (1 + total_attempts))
  → Early answers have low confidence (3 correct out of 3 ≠ mastered)
  → Saturates toward 1.0 after ~20 attempts
```

**Example:**
- Student answered 7/10 questions on Limits correctly, last attempt 2 days ago
- recency_weight = e^(-0.1 * 2) ≈ 0.82
- confidence_weight = 1 - 1/(1+10) ≈ 0.91
- mastery_score = 0.70 * 0.82 * 0.91 ≈ 0.52

### 5.4 Misconception Detection

When a student answers a question wrong, we don't just mark it wrong. We send the wrong answer + correct answer to the LLM:

```
Prompt:
  Question: "What is the derivative of sin(x)?"
  Correct Answer: cos(x)
  Student Answer: -cos(x)
  
  Identify the specific misconception this student has.
  Is this: (A) sign error, (B) chain rule confusion, (C) memorization gap, (D) other?
  Explain in 1 sentence what the student misunderstood.
```

This generates a `misconception_tag` like `"mixed up derivative signs for trig functions"`.

These tags are stored in the student profile under each concept and used to:
1. Target flashcards specifically at the misconception
2. Generate hints that address the root cause, not just re-explain
3. Alert the student: "You've made this mistake 3 times: [description]"

### 5.5 Interaction Signals (Behavioral Modeling)

The frontend sends interaction events to the backend:

```json
{
  "event_type": "quiz_hesitation",
  "concept": "Chain Rule",
  "duration_ms": 35000,     // student paused 35 seconds before answering
  "timestamp": "2025-04-22T10:30:00Z"
}
```

Event types tracked:
- `quiz_start`, `quiz_answer`, `quiz_skip`
- `hesitation` (> 15s pause on a question)
- `hint_requested`
- `content_backtrack` (went back to re-read a section)
- `flashcard_flip_time` (how long before flipping)

These signals feed into the "confusion detection" heuristic:

```
confusion_score for a concept =
  (hesitation_count * 2) + (backtrack_count * 3) + (hint_requests * 1.5)
  normalized to [0, 1]
```

If `confusion_score > 0.6`, the system flags the concept as "likely confusing even if answers are correct."

### 5.6 APIs

| Endpoint | Method | Description |
|---|---|---|
| `/api/student/profile` | GET | Get full student profile |
| `/api/student/mastery` | GET | Get mastery scores per concept |
| `/api/student/weak-concepts` | GET | Get prioritized list of weak areas |
| `/api/student/update` | POST | Submit quiz result, update model |
| `/api/student/interaction` | POST | Log an interaction event |

---

## 6. ENGINE 3 – ADAPTIVE LEARNING ENGINE

### 6.1 Purpose

This engine is the **decision-maker**. It answers: "Given everything we know about this student, what should they do next?"

### 6.2 The SM-2 Spaced Repetition Algorithm

SM-2 is the algorithm behind Anki. It computes **when** a student should review a concept based on performance.

**How SM-2 Works:**

Every concept has three values:
- `interval` (I): days until next review
- `easiness_factor` (EF): how easy this concept is for this student (starts at 2.5)
- `repetition` (n): how many times reviewed without forgetting

After each quiz, the student's performance is rated 0–5:
- 5: Perfect response
- 4: Correct with slight hesitation  
- 3: Correct with difficulty
- 2: Wrong but felt close
- 1: Wrong, hard to recall
- 0: Complete blank

**Update rules:**
```python
def sm2_update(interval, ef, repetitions, quality):
    if quality >= 3:  # correct response
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ef)
        repetitions += 1
    else:
        repetitions = 0
        interval = 1
    
    ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ef = max(ef, 1.3)   # EF never drops below 1.3
    
    return interval, ef, repetitions
```

**Example walkthrough:**
- First review of "Limits": I=1, EF=2.5, n=0
- Student scores 4 (good recall) → I=6, EF=2.5, n=1
- After 6 days, scores 5 (perfect) → I=round(6*2.5)=15, EF=2.6, n=2
- After 15 days, scores 3 (barely remembered) → I=round(15*1.3)=20, EF=2.48, n=3

The concept is scheduled further and further apart as the student demonstrates retention.

### 6.3 Next-Topic Recommendation Algorithm

The recommendation engine scores all available concepts and picks the highest-scoring one:

```python
def recommend_next_topic(student_profile, knowledge_graph):
    scores = {}
    
    for concept in all_concepts:
        score = 0.0
        
        # Factor 1: Is it due for review? (Spaced repetition urgency)
        days_overdue = (today - concept.next_review_date).days
        if days_overdue > 0:
            score += min(days_overdue * 0.3, 3.0)  # capped at 3.0
        
        # Factor 2: Is the mastery low? (Needs work)
        score += (1 - concept.mastery_score) * 2.0
        
        # Factor 3: Are prerequisites satisfied?
        prereqs = knowledge_graph.predecessors(concept)
        prereqs_mastered = all(p.mastery_score > 0.7 for p in prereqs)
        if not prereqs_mastered:
            score -= 5.0   # heavily penalize if foundations missing
        
        # Factor 4: Recency penalty (don't repeat same topic twice in a row)
        if concept == last_studied:
            score -= 2.0
        
        scores[concept] = score
    
    return max(scores, key=scores.get)
```

### 6.4 Prerequisite Redirection

When the system detects that a student is failing a concept because of a weak prerequisite:

```python
def check_prerequisite_redirect(concept, student_profile, graph):
    prerequisites = list(graph.predecessors(concept))
    
    for prereq in prerequisites:
        mastery = student_profile.topic_mastery.get(prereq.name, {}).get("score", 0)
        if mastery < 0.5:  # threshold: below 50% mastery
            return {
                "redirect": True,
                "to": prereq,
                "message": f"You're struggling with {concept.name} because "
                           f"{prereq.name} needs more work. Let's fix that first."
            }
    
    return {"redirect": False}
```

This is triggered when:
- Student fails 3+ consecutive questions on a concept
- Mastery score drops below 0.35

### 6.5 Learning Path Generator

For new students or new topics, the system generates a full study path:

```python
def generate_learning_path(target_concept, student_profile, graph):
    # Topological sort of all ancestors of target_concept
    ancestors = nx.ancestors(graph, target_concept)
    subgraph = graph.subgraph(ancestors | {target_concept})
    path = list(nx.topological_sort(subgraph))
    
    # Filter out already mastered concepts
    path = [c for c in path if student_profile.mastery(c) < 0.8]
    
    return path
```

Example: If target = "Integration by Parts", path might be:
`[Functions → Limits → Derivatives → Basic Integration → Integration by Parts]`

---

## 7. ENGINE 4 – GENERATIVE PEDAGOGY ENGINE

### 7.1 Purpose

This engine **creates learning content** tailored to the student. It uses LLMs to generate content that:
- Targets specific weak areas
- Addresses known misconceptions
- Adapts to current mastery level (simple for beginners, complex for advanced)

### 7.2 Flashcard Generator

**What it does**: Creates question-answer pairs focused on weak spots.

**Prompt structure:**
```
You are an expert tutor. Generate 5 flashcards for the concept: {concept_name}

Student profile:
- Mastery score: {mastery_score}/1.0
- Known misconceptions: {misconceptions}
- Difficulty level: {beginner|intermediate|advanced}

Context from student's notes:
{relevant_chunk_text}

Rules:
- Target the specific misconceptions listed
- If mastery < 0.4: focus on definitions and basic understanding
- If mastery 0.4-0.7: focus on application
- If mastery > 0.7: focus on edge cases and synthesis
- Format each as JSON: {"front": "...", "back": "..."}
```

**Output example:**
```json
[
  {"front": "What is the chain rule formula?", "back": "d/dx[f(g(x))] = f'(g(x)) · g'(x)"},
  {"front": "Common mistake: Why is d/dx[sin(x²)] NOT cos(x²)?", "back": "You must apply chain rule: cos(x²) · 2x"}
]
```

### 7.3 Quiz Question Generator

**Multiple choice generation:**
```
Generate a multiple-choice question about {concept}.
Difficulty: {difficulty_level}
Student's weakness: {misconception}

Requirements:
- One clearly correct answer
- Three plausible distractors that reflect common misconceptions
- The wrong answers should each represent a specific error type

Return JSON: {
  "question": "...",
  "options": ["A: ...", "B: ...", "C: ...", "D: ..."],
  "correct": "A",
  "explanation": "...",
  "misconception_tested": "..."
}
```

**IRT (Item Response Theory) difficulty calibration:**

Each question has a difficulty parameter `b` (typically -3 to +3). The probability that a student with ability `θ` answers correctly:

```
P(correct | θ, b) = 1 / (1 + e^(-(θ - b)))
```

If a student's mastery_score = 0.7, map to `θ ≈ 0.7 * 6 - 3 = 1.2`

We select questions where `P(correct)` is between 0.4 and 0.8 — the **zone of proximal development**: not too easy (boring), not too hard (frustrating).

### 7.4 Socratic Question Generator

Instead of giving answers, we guide students to discover them.

```
A student is trying to understand: {concept}
Their current response was: {student_response}
The correct direction is: {correct_direction}

Generate a Socratic question that:
1. Does NOT give away the answer
2. Points to a gap in their reasoning
3. Is a genuine question, not a hint in disguise
4. Builds on what they already said correctly
```

**Example:**
- Concept: "Why does lim(x→0) sin(x)/x = 1?"
- Student says: "Because sin(0) = 0 and 0/0 = 1"
- Socratic response: "You're right that sin(0) = 0. But what does 0/0 actually mean? Can we directly compute 0 divided by 0?"

### 7.5 Hint System

Hints are **layered** – students request progressively more revealing hints:

```
Level 1 hint: Re-read the definition of {concept}
Level 2 hint: Think about {related_concept}. How does it apply here?
Level 3 hint: The key insight is {partial_explanation_without_full_answer}
Level 4 hint: Full worked example with the answer explained step by step
```

```
Generate a {level}/4 hint for this problem:
Problem: {question}
Student's wrong answer: {student_answer}
Known misconception: {misconception}

Hint level guide:
- Level 1: conceptual direction only
- Level 2: identify which sub-skill is needed
- Level 3: show the first step without completing
- Level 4: full explanation
```

### 7.6 Summary Generator

Generates personalized summaries of content:

```
Summarize the topic {concept} for a student who:
- Has mastery score: {score}/1.0
- Learns best through: {visual|example-based|formal}
- Common confusion: {misconception}

Use the following source material:
{chunk_text}

Keep it under 200 words. Highlight the parts most relevant to their weak areas.
```

### 7.7 Mind Map Generator

Uses the knowledge graph to produce a visual concept map.

The mind map is generated as a **React Flow** node-edge structure:

```python
def generate_mindmap_data(document_id, student_profile):
    graph = load_graph(document_id)
    nodes = []
    edges = []
    
    for concept in graph.nodes():
        mastery = student_profile.mastery(concept)
        nodes.append({
            "id": concept.id,
            "label": concept.name,
            "color": mastery_to_color(mastery),  # red=weak, green=strong
            "size": len(list(graph.successors(concept))) + 1  # bigger if many dependents
        })
    
    for src, dst in graph.edges():
        edges.append({"source": src.id, "target": dst.id})
    
    return {"nodes": nodes, "edges": edges}

def mastery_to_color(mastery):
    if mastery < 0.3: return "#ef4444"   # red
    if mastery < 0.6: return "#f59e0b"   # amber
    if mastery < 0.8: return "#3b82f6"   # blue
    return "#22c55e"                     # green
```

Students can **click any node** to jump to that topic, generate flashcards for it, or see its prerequisites.

---

## 8. ENGINE 5 – ANALYTICS & BEHAVIOR ENGINE

### 8.1 Purpose

Closes the feedback loop. Shows the student **where they are, how they're progressing, and where to focus**.

### 8.2 Key Metrics Computed

**Learning Velocity:**
```
velocity = (mastery_score_today - mastery_score_7_days_ago) / 7
```
Positive = improving, negative = forgetting curve winning.

**Topic Mastery Distribution:**
- Pie/radar chart showing mastery across all topics
- Color-coded: red < 40%, amber 40–70%, green > 70%

**Weakness Clusters:**
Group related weak topics together using graph neighborhood:
```python
def get_weakness_clusters(student_profile, graph):
    weak_nodes = [c for c in graph.nodes() if student_profile.mastery(c) < 0.5]
    subgraph = graph.subgraph(weak_nodes)
    # Find connected components in the weak subgraph
    return list(nx.weakly_connected_components(subgraph))
```

**Study Session Heatmap:**
Track which days/hours the student studies → show calendar heatmap like GitHub contributions.

**Prediction (Optional Advanced):**
Using a simple linear regression on past mastery scores, project when each concept will reach 0.8 mastery:
```
days_to_mastery = (0.8 - current_mastery) / avg_daily_gain
```

### 8.3 Dashboard Components

1. **Overview Card**: Total topics studied, overall mastery %, streak
2. **Radar Chart**: Mastery across topic domains
3. **Study Calendar**: Heatmap of study activity
4. **Weak Areas Panel**: Prioritized list of concepts needing work
5. **Next Review Queue**: SM-2 scheduled reviews for today
6. **Learning Velocity Chart**: Line chart of mastery gain over time
7. **Misconception Log**: History of detected errors

---

## 9. API REFERENCE

### 9.1 Authentication

All endpoints require JWT Bearer token:
```
Authorization: Bearer <token>
```

**Login:**
```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "access_token": "...", "token_type": "bearer" }
```

### 9.2 Document Endpoints

```
POST   /api/documents/upload              Upload PDF or text
GET    /api/documents/                    List user's documents
GET    /api/documents/{id}                Get document details
GET    /api/documents/{id}/concepts       Get extracted concepts
GET    /api/documents/{id}/graph          Get knowledge graph JSON
DELETE /api/documents/{id}               Delete document
```

### 9.3 Quiz Endpoints

```
POST   /api/quiz/generate                 Generate quiz for a concept
POST   /api/quiz/submit                   Submit answers, update student model
GET    /api/quiz/history                  Get past quiz attempts
POST   /api/flashcards/generate           Generate flashcards
POST   /api/hints/generate                Get a hint for a question
```

### 9.4 Chat Endpoint

```
POST   /api/chat/message
Body: {
  "message": "Explain chain rule",
  "context_concept": "Derivatives",    // optional: focus context
  "conversation_history": [...]        // previous messages for multi-turn
}
Response: {
  "response": "...",
  "sources": [...],          // which chunks were used
  "related_concepts": [...]  // suggested follow-up topics
}
```

### 9.5 Student / Analytics Endpoints

```
GET    /api/student/profile               Full student profile
GET    /api/student/next-topic            Recommended next topic
GET    /api/student/learning-path/{concept}  Get path to target concept
GET    /api/analytics/dashboard           Dashboard data
GET    /api/analytics/mastery-timeline    Mastery over time
GET    /api/analytics/weakness-clusters   Grouped weak areas
POST   /api/student/interaction           Log interaction event
```

---

## 10. DATABASE SCHEMA

### 10.1 Complete Schema

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Documents uploaded by users
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    filename VARCHAR(500),
    file_path VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, complete, failed
    created_at TIMESTAMP DEFAULT NOW()
);

-- Extracted concepts from documents
CREATE TABLE concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    chunk_text TEXT,
    page_number INTEGER,
    embedding_id VARCHAR(255),  -- reference to vector store
    created_at TIMESTAMP DEFAULT NOW()
);

-- Prerequisite relationships between concepts
CREATE TABLE concept_prerequisites (
    concept_id UUID REFERENCES concepts(id),
    prerequisite_id UUID REFERENCES concepts(id),
    confidence FLOAT DEFAULT 1.0,
    source VARCHAR(50),  -- 'llm', 'document_order', 'embedding'
    PRIMARY KEY (concept_id, prerequisite_id)
);

-- Per-user mastery of each concept
CREATE TABLE topic_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    concept_id UUID REFERENCES concepts(id),
    mastery_score FLOAT DEFAULT 0.0,
    attempts INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    easiness_factor FLOAT DEFAULT 2.5,   -- SM-2
    interval_days INTEGER DEFAULT 1,     -- SM-2
    repetition_count INTEGER DEFAULT 0,  -- SM-2
    last_reviewed TIMESTAMP,
    next_review TIMESTAMP,
    misconceptions TEXT[],               -- array of misconception tags
    UNIQUE(user_id, concept_id)
);

-- Quiz attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    concept_id UUID REFERENCES concepts(id),
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    student_answer TEXT,
    is_correct BOOLEAN,
    quality_score INTEGER,  -- SM-2 quality (0-5)
    misconception_tag VARCHAR(255),
    time_taken_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Interaction events
CREATE TABLE interaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    concept_id UUID REFERENCES concepts(id),
    event_type VARCHAR(100),
    duration_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Generated flashcards
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    concept_id UUID REFERENCES concepts(id),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat history
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50),  -- 'user' or 'assistant'
    content TEXT,
    context_concept_id UUID REFERENCES concepts(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. FRONTEND ARCHITECTURE

### 11.1 Page-by-Page Breakdown

**Dashboard (Home Page)**
- Summary cards: topics studied, overall mastery, study streak
- Today's review queue (SM-2 due cards)
- Quick-access buttons: Study, Quiz, Upload
- Recent activity feed

**Upload Page**
- Drag-and-drop zone (react-dropzone)
- Progress indicator (processing status polling)
- Preview of extracted topics once processing complete
- Option to add notes or paste text

**Study Page**
- Left panel: Topic navigator (from knowledge graph)
- Center: Content display (original text + AI summary)
- Right panel: Flashcard stack for current topic
- "Explain this differently" button → regenerates explanation
- "Quiz me" button → jumps to quiz for this topic

**Quiz Page**
- One question at a time
- Progress bar (question N of M)
- Timer per question (optional)
- Hint button (progressive hints)
- After wrong answer: Misconception explanation + link to prerequisite review
- After quiz: Score summary + mastery delta + next recommendation

**Mind Map Page**
- React Flow canvas
- Color-coded nodes by mastery (red/amber/blue/green)
- Click node → side panel with: mastery score, flashcards, quiz link
- Zoom, pan, fit-to-screen controls
- Filter by mastery level

**Analytics Page**
- Radar chart of topic mastery
- Line chart of mastery over time
- Study calendar heatmap
- Weakness clusters list
- Misconception log

**Chat Page**
- Conversational interface
- Context-aware: answers use student's actual notes
- "I'm confused about X" → system identifies concept, routes to study
- Shows source references from student's documents

### 11.2 State Management (Zustand)

```typescript
// userStore.ts
interface UserStore {
  user: User | null;
  profile: StudentProfile | null;
  setUser: (user: User) => void;
  fetchProfile: () => Promise<void>;
}

// studyStore.ts
interface StudyStore {
  currentDocument: Document | null;
  currentConcept: Concept | null;
  flashcards: Flashcard[];
  quizQuestions: Question[];
  knowledgeGraph: GraphData | null;
  setCurrentConcept: (concept: Concept) => void;
  fetchFlashcards: (conceptId: string) => Promise<void>;
  generateQuiz: (conceptId: string) => Promise<void>;
}
```

---

## 12. ALGORITHMS DEEP DIVE

### 12.1 SM-2 Complete Implementation

```python
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class SM2State:
    interval: int = 1       # days until next review
    ef: float = 2.5         # easiness factor
    repetitions: int = 0    # streak of correct reviews

def sm2_update(state: SM2State, quality: int) -> SM2State:
    """
    quality: 0-5 integer
      5 = perfect
      4 = correct, slight hesitation
      3 = correct, significant difficulty
      2 = incorrect, correct felt easy after seeing answer
      1 = incorrect, correct felt hard after seeing answer
      0 = complete blackout
    """
    assert 0 <= quality <= 5, "Quality must be 0-5"
    
    new_state = SM2State(state.interval, state.ef, state.repetitions)
    
    if quality >= 3:
        if state.repetitions == 0:
            new_state.interval = 1
        elif state.repetitions == 1:
            new_state.interval = 6
        else:
            new_state.interval = round(state.interval * state.ef)
        new_state.repetitions = state.repetitions + 1
    else:
        new_state.repetitions = 0
        new_state.interval = 1
    
    new_state.ef = state.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_state.ef = max(new_state.ef, 1.3)
    
    return new_state

def compute_next_review(state: SM2State) -> datetime:
    return datetime.now() + timedelta(days=state.interval)
```

### 12.2 Mastery Score with Exponential Decay

```python
import math
from datetime import datetime

def compute_mastery(attempts: list[dict]) -> float:
    """
    attempts: list of {correct: bool, timestamp: datetime}
    Returns mastery score 0.0 to 1.0
    """
    if not attempts:
        return 0.0
    
    decay_rate = 0.05  # per day
    now = datetime.now()
    
    weighted_correct = 0.0
    weighted_total = 0.0
    
    for attempt in attempts:
        days_ago = (now - attempt["timestamp"]).days
        weight = math.exp(-decay_rate * days_ago)
        weighted_total += weight
        if attempt["correct"]:
            weighted_correct += weight
    
    if weighted_total == 0:
        return 0.0
    
    raw_accuracy = weighted_correct / weighted_total
    
    # Confidence scaling: fewer attempts = lower confidence in score
    n = len(attempts)
    confidence = 1 - (1 / (1 + n * 0.5))
    
    # Blend raw accuracy with confidence
    return raw_accuracy * confidence + 0.5 * (1 - confidence) * raw_accuracy
```

### 12.3 Semantic Search for RAG (Chat)

When a student asks a question in chat, we retrieve the most relevant chunks from their documents:

```python
import chromadb
from openai import OpenAI

client = OpenAI()
chroma = chromadb.Client()

def semantic_search(query: str, document_id: str, top_k: int = 5):
    # 1. Embed the query
    query_embedding = client.embeddings.create(
        input=query,
        model="text-embedding-3-small"
    ).data[0].embedding
    
    # 2. Search ChromaDB for similar chunks
    collection = chroma.get_collection(f"doc_{document_id}")
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    
    # 3. Return top chunks with their metadata
    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        chunks.append({
            "text": doc,
            "page": results["metadatas"][0][i]["page_number"],
            "similarity": 1 - results["distances"][0][i]
        })
    
    return chunks

def chat_response(user_message: str, student_profile: dict, document_id: str):
    # Retrieve relevant chunks
    chunks = semantic_search(user_message, document_id)
    context = "\n\n".join([c["text"] for c in chunks])
    
    # Build prompt with context
    system_prompt = f"""You are an intelligent tutor.
Student mastery context: {student_profile['weak_concepts']}
Adapt your explanation to their level.
Always use their actual notes as primary source.

Student's notes context:
{context}
"""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )
    
    return response.choices[0].message.content
```

---

## 13. SETUP & DEPLOYMENT

### 13.1 Local Development Setup

**Prerequisites:**
- Python 3.11+
- Node.js 20+
- Docker Desktop
- PostgreSQL (or use Docker)

**Backend Setup:**
```bash
# Clone repo
git clone https://github.com/yourname/acls.git
cd acls/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY=sk-...
#   DATABASE_URL=postgresql://user:pass@localhost:5432/acls
#   SECRET_KEY=your-jwt-secret
#   REDIS_URL=redis://localhost:6379

# Run database migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

**Frontend Setup:**
```bash
cd acls/frontend
npm install

# Configure environment
cp .env.example .env.local
# VITE_API_BASE_URL=http://localhost:8000

npm run dev
```

**Docker (everything at once):**
```bash
docker-compose up --build
```

### 13.2 docker-compose.yml

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: acls
      POSTGRES_USER: acls_user
      POSTGRES_PASSWORD: acls_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://acls_user:acls_pass@postgres:5432/acls
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  celery_worker:
    build: ./backend
    command: celery -A app.celery_app worker --loglevel=info
    depends_on:
      - redis
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 14. TESTING STRATEGY

### 14.1 Backend Tests

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

**Test categories:**
- **Unit tests**: SM-2 algorithm, mastery score computation, text chunking
- **Integration tests**: API endpoints with test database
- **LLM tests**: Mock OpenAI responses, verify prompt structure

### 14.2 Frontend Tests

```bash
# Run tests
npm test

# Run E2E tests (Playwright)
npx playwright test
```

**Test categories:**
- **Component tests**: Each React component renders correctly
- **Store tests**: Zustand store actions work correctly
- **E2E tests**: Full user flows (upload → quiz → analytics)

### 14.3 Evaluation Metrics

- **Quiz generation accuracy**: Manual review of 50 generated questions for correctness
- **Misconception detection precision**: Compare LLM-detected misconceptions to human expert labels
- **Recommendation relevance**: Track if recommended topics improve mastery faster than random
- **User satisfaction**: Post-session surveys (rate 1-5: "Was the recommended content helpful?")

---

## 15. GLOSSARY

| Term | Definition |
|---|---|
| **SM-2** | SuperMemo 2 algorithm for spaced repetition scheduling |
| **Mastery Score** | 0.0–1.0 value representing how well a student knows a concept |
| **Knowledge Graph** | Directed graph where nodes are concepts and edges are prerequisites |
| **Embedding** | High-dimensional vector representing the semantic meaning of text |
| **RAG** | Retrieval-Augmented Generation – using retrieved context to ground LLM responses |
| **Chunking** | Splitting documents into smaller, semantically coherent pieces |
| **IRT** | Item Response Theory – mathematical framework for question difficulty calibration |
| **Socratic Method** | Teaching through guided questions rather than direct answers |
| **Misconception** | A specific wrong belief a student holds about a concept |
| **Prerequisite** | A concept that must be understood before another can be learned |
| **EF (Easiness Factor)** | SM-2 parameter representing how easy a card is for a specific student |
| **Spaced Repetition** | Reviewing material at increasing intervals to optimize long-term retention |
| **Vector Database** | Database optimized for storing and searching high-dimensional vectors |
| **ChromaDB** | Open-source vector database, used for semantic search |
| **pgvector** | PostgreSQL extension for storing and querying vector embeddings |
| **Celery** | Python distributed task queue for background processing |
| **JWT** | JSON Web Token – stateless authentication mechanism |
| **Alembic** | Database migration tool for SQLAlchemy |
