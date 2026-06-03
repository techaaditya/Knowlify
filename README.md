# 🧠 Knowlify — Adaptive Cognitive Learning System (ACLS)

> An AI-powered adaptive learning platform that transforms raw educational documents into interactive knowledge graphs, tracks student mastery in real-time, and generates personalised study experiences.

---

## 📐 Project Architecture

```
Knowlify/
├── .gitignore
├── README.md
├── docker-compose.yml          # PostgreSQL, Redis, and backend containers
├── docs/                       # Architecture docs, defense slides
│   ├── ACLS_Engine1_Documentation.md
│   └── Explanation.md
│
├── backend/                    # Python FastAPI Backend
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                # Database migrations
│   └── app/
│       ├── main.py             # FastAPI entry point
│       ├── config.py           # Environment config
│       ├── database.py         # PostgreSQL + pgvector setup
│       ├── models/             # SQLAlchemy table definitions
│       ├── schemas/            # Pydantic request/response models
│       ├── routers/            # Modular API endpoints
│       │   ├── analytics.py    # GET /api/student, GET /api/graph
│       │   ├── documents.py    # POST /api/extract
│       │   ├── chat.py         # POST /api/chat
│       │   └── quiz.py         # POST /api/attempt
│       └── engines/            # 🧠 The 5 Core AI Engines
│           ├── context/        # Engine 1 — Knowledge Graph Construction
│           ├── cognitive/      # Engine 2 — BKT & Misconception Diagnosis
│           ├── adaptive/       # Engine 3 — Spaced Repetition (SM-2)
│           ├── generative/     # Engine 4 — Flashcards & Socratic Qs
│           └── analytics/      # Engine 5 — Dashboard Calculations
│
└── frontend/                   # React + TypeScript Frontend (Vite)
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css           # Alabaster Design System + Tailwind
    │   ├── api/client.ts       # Axios client
    │   ├── store/              # Zustand state management
    │   ├── pages/              # Full-page views
    │   └── components/         # Reusable UI widgets
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Ollama running locally (optional, falls back to heuristics)

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate         # Windows
pip install -r requirements.txt
cp .env.example .env          # Edit with your credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Docker (Full Stack)

```bash
docker-compose up --build
```

---

## 🧠 The 5 AI Engines

| Engine | Name | Status |
|--------|------|--------|
| 1 | Context Engine (PDF → Knowledge Graph) | ✅ Built |
| 2 | Cognitive Engine (BKT & Misconceptions) | ✅ Built |
| 3 | Adaptive Engine (SM-2 Spaced Repetition) | 🔧 Stub |
| 4 | Generative Engine (Flashcards & Socratic) | 🔧 Stub |
| 5 | Analytics Engine (Dashboard Metrics) | 🔧 Stub |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student` | Get student profile + mastery data |
| GET | `/api/graph?course=Calculus` | Get knowledge graph nodes + edges |
| POST | `/api/attempt` | Record a quiz attempt |
| POST | `/api/extract` | Run PDF extraction pipeline |
| POST | `/api/chat` | Socratic tutoring chat |

---

## 🗂️ Branch: `Aaditya`
