# 🧠 Knowlify - Adaptive Cognitive Learning System (ACLS)

> An AI-powered adaptive learning platform that turns raw study material into an interactive knowledge graph, tracks each learner's mastery in real time, and generates personalised, source-grounded study experiences.

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white">
  <img alt="Ollama" src="https://img.shields.io/badge/LLM-Ollama-000000?logo=ollama&logoColor=white">
</p>

---

## 📚 Table of Contents

- [What is Knowlify?](#-what-is-knowlify)
- [The Learner Experience](#-the-learner-experience)
- [The 5 AI Engines](#-the-5-ai-engines)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#-prerequisites)
  - [1. Run the Backend](#-1-run-the-backend-fastapi)
  - [2. Run the Frontend](#-2-run-the-frontend-react--vite)
  - [3. Run via Docker Compose](#-3-run-via-docker-compose-full-stack)
  - [4. Set Up PostgreSQL](#-4-set-up-postgresql-optional)
  - [5. Student-Model CLI Demo](#-5-student-model-cli-demo-optional)
- [API Reference](#-api-reference)
- [Authentication & Data Isolation](#-authentication--data-isolation)
- [Configuration](#-configuration)

---

## 🎯 What is Knowlify?

Most study tools sit in separate silos - one app to read documents, another to make
flashcards, a third to quiz yourself - and none of them actually understand what you
are learning. Knowlify unifies the whole loop into one system built around **the
learner's own material**:

1. **Ingest** any source - PDF, DOCX, PPTX, Markdown, a website, a YouTube video, or
   pasted text.
2. **Understand** it - the Context Engine extracts concepts and builds a prerequisite
   **knowledge graph** with keyword-scored, cited grounding.
3. **Model** the learner - every quiz and flashcard attempt updates a Bayesian mastery
   estimate and flags recurring misconceptions.
4. **Adapt** - a spaced-repetition scheduler and a prerequisite guard decide *what to
   study next* and *when*.
5. **Generate & visualise** - source-grounded quizzes, flashcards, notes, study guides,
   a Socratic tutor, and an animated **AI Canvas**, all tracked on a live analytics
   dashboard.

Everything is scoped per user and persists across restarts.

---

## 🧭 The Learner Experience

The React app is organised into six focused areas, reachable from the sidebar:

| Section | What it does |
|---------|--------------|
| **🏠 Home** | A single dashboard combining the workspace at a glance (sources, chunks, entities, relationships) with learning analytics - mastery, accuracy, weak areas, misconceptions, a revision planner, learning velocity, a study heatmap, and the adaptive "next step" recommendation. |
| **📚 Library** | Upload and manage sources, watch the ingestion pipeline process them live, and select which sources to study. |
| **🤖 AI Tutor** | A source-grounded chat tutor with teaching modes (explain, step-by-step, Socratic, worked example) and inline quiz/flashcard cards. |
| **🕸️ Knowledge Map** | The interactive prerequisite graph of the concepts extracted from your sources. |
| **🎨 AI Canvas** | Turns a concept into an animated, interactive explanation - mind maps, infographics, plots, and video-style lessons. |
| **🧩 Study Tools** | On-demand generation of quizzes, flashcards, notes, and study guides, plus a history of everything you've generated. |

A persistent **AI Companion** dock rides along in the corner, offering proactive nudges,
a full-screen Quiz Arena, and one-tap "explain this" hand-offs from anywhere in the app.

---

## 🧠 The 5 AI Engines

| Engine | Name | Description | Status |
|:------:|------|-------------|:------:|
| **1** | **Context Engine** | Multi-source ingestion (PDF, DOCX, PPTX, web, YouTube, notes) → concept extraction with KeyBERT and a prerequisite knowledge graph built on NetworkX. | ✅ Built |
| **2** | **Cognitive Engine** | Tracks student mastery with Bayesian Knowledge Tracing and diagnoses repeated misconceptions. | ✅ Built |
| **3** | **Adaptive Engine** | Schedules reviews via SM-2 spaced repetition and gates topics behind a prerequisite guard. | ✅ Built |
| **4** | **Generative Engine** | Produces source-grounded quizzes, flashcards, notes, study guides, Socratic dialogue, and progressive hints. | ✅ Built |
| **5** | **Analytics Engine** | Powers the dashboard - mastery radar, learning velocity, weak-area ranking, heatmaps, and graph coverage. | ✅ Built |

Supporting modules - an **ingestion** pipeline and a **dashboard** aggregator - sit
alongside the five core engines.

---

## 📐 Project Architecture

```
Knowlify/
├── README.md
├── docker-compose.yml           # PostgreSQL (pgvector), Redis, and backend containers
├── sample.pdf                   # Example source for a quick end-to-end test
├── docs/                        # Architecture docs & defense material
│   ├── ACLS_Engine1_Documentation.md
│   └── Explanation.md
│
├── backend/                     # Python · FastAPI
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── setup_postgres.py        # One-shot PostgreSQL bootstrap
│   ├── alembic.ini · alembic/   # Database migrations
│   └── app/
│       ├── main.py              # FastAPI entry point (registers 9 routers)
│       ├── config.py            # Environment configuration
│       ├── database.py          # SQLAlchemy engine - PostgreSQL with SQLite fallback
│       ├── models/              # SQLAlchemy table definitions
│       ├── schemas/             # Pydantic request/response models
│       ├── services/            # Cross-engine helpers (auth, persistence)
│       ├── routers/             # Modular API endpoints
│       │   ├── auth.py          # /api/auth/*  - signup, login, Google, reset
│       │   ├── sources.py       # /api/sources/* - upload, website, YouTube, manage
│       │   ├── workspaces.py    # /api/workspaces/* - dashboard & merged graph
│       │   ├── documents.py     # /api/extract - run the extraction pipeline
│       │   ├── chat.py          # /api/chat, /api/chat/answer, /api/chat/history
│       │   ├── quiz.py          # /api/quiz/*, /api/flashcards/*, /api/generate/*
│       │   ├── adaptive.py      # /api/adaptive/recommendation
│       │   ├── analytics.py     # /api/student
│       │   └── dashboard.py     # /api/dashboard/student
│       └── engines/             # 🧠 The AI engines
│           ├── context/         # Engine 1 - Knowledge-graph construction
│           ├── cognitive/       # Engine 2 - BKT & misconception diagnosis
│           ├── adaptive/        # Engine 3 - SM-2 spaced repetition
│           ├── generative/      # Engine 4 - Quizzes, flashcards, tutor, hints
│           ├── analytics/       # Engine 5 - Dashboard calculations
│           ├── ingestion/       # Source parsing & chunking
│           └── dashboard/       # Dashboard aggregation
│
└── frontend/                    # React + TypeScript · Vite
    ├── src/
    │   ├── App.tsx              # App shell, sidebar, and view routing
    │   ├── main.tsx             # Auth gate + bootstrap
    │   ├── index.css            # Warm Alabaster design system + Tailwind tokens
    │   ├── api/                 # Axios client & typed endpoint wrappers
    │   ├── store/               # Zustand state management
    │   ├── pages/               # Full-page views (Home, Library, Study Tools, …)
    │   ├── companion/           # The AI Learning Companion (dock, quiz arena, brain)
    │   └── components/          # Reusable UI
    │       ├── shared/          # Shared chat, quiz, flashcard & markdown primitives
    │       ├── Chat/ · Sources/ · KnowledgeMap/ · AICanvas/ · Dashboard/ · Auth/
    │       └── Workspace/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## 🚀 Getting Started

Run the backend and frontend on your local machine. Commands are shown for Windows
(PowerShell / Git Bash); adapt paths as needed on macOS or Linux.

### 📋 Prerequisites

- **Python 3.11+** (added to your system `PATH`)
- **Node.js 18+** (includes `npm`)
- **[Ollama](https://ollama.com/)** running locally for embeddings and the tutor model:
  1. **Start the daemon** - launch the Ollama desktop app (system-tray icon) or run:
     ```powershell
     ollama serve
     ```
  2. **Pull the models** (first time only - they are cached afterwards):
     ```powershell
     ollama pull nomic-embed-text
     ollama pull gpt-oss:120b-cloud
     ```
  3. **Keep it running** in the background whenever the backend is up.

> [!NOTE]
> **`HF_TOKEN` warning:** On startup you may see *"You are sending unauthenticated
> requests to the HF Hub…"*. This is a harmless notice from `huggingface_hub`, which
> KeyBERT uses to download `all-MiniLM-L6-v2` locally. No token is required.

---

### 🐍 1. Run the Backend (FastAPI)

<details open>
<summary><b>Windows PowerShell / Command Prompt</b></summary>

```powershell
cd backend

# Activate the pre-configured virtual environment
.\venv\Scripts\Activate.ps1      # PowerShell
# .\venv\Scripts\activate.bat     # Command Prompt

uvicorn app.main:app --reload --port 8000
```
</details>

<details>
<summary><b>Git Bash / macOS / Linux</b></summary>

```bash
cd backend
source venv/Scripts/activate      # Git Bash on Windows
# source venv/bin/activate         # macOS / Linux

uvicorn app.main:app --reload --port 8000
```
</details>

> [!NOTE]
> The backend runs at [localhost:8000](http://localhost:8000). Interactive Swagger docs
> are at [localhost:8000/docs](http://localhost:8000/docs).

---

### ⚛️ 2. Run the Frontend (React + Vite)

In a **new terminal**:

```bash
cd frontend
npm install          # first time only
npm run dev
```

> [!NOTE]
> The dev server starts at [localhost:5173](http://localhost:5173) and talks to the
> backend on port `8000` automatically.

---

### 🐳 3. Run via Docker Compose (Full Stack)

To run the backend together with PostgreSQL and Redis in containers:

```bash
docker-compose up --build
```

---

### 🐘 4. Set Up PostgreSQL (Optional)

By default the backend falls back to a local **SQLite** file (`knowlify.db`) when
PostgreSQL is unavailable, so this step is optional. To use PostgreSQL:

#### Step 1 - Install PostgreSQL

Download the installer from
[postgresql.org/download](https://www.postgresql.org/download/windows/) and run the
wizard. Remember the `postgres` superuser password (you'll need it below), keep the
default port **5432**, and optionally include **pgAdmin 4**. Confirm the service is
running:

```powershell
Get-Service -Name "postgresql*"   # Status should be Running
```

#### Step 2 - Install the Python driver

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install psycopg2-binary
```

#### Step 3 - Configure `.env`

In `backend/.env`, set `DATABASE_URL` with your actual password:

```env
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/knowlify
```

#### Step 4 - Bootstrap the database

```powershell
cd backend
python setup_postgres.py
```

This connects to PostgreSQL, creates the `knowlify` database, enables the `uuid-ossp`
extension, and creates every table.

#### Step 5 - Verify

Start the backend and look for:

```
[database] Initialised 15 tables on postgresql
```

If you see `on sqlite` instead, check that `psycopg2-binary` is installed and your
password is correct.

> [!NOTE]
> **Schema (15 tables):** `users`, `workspaces`, `sources`, `source_chunks`,
> `processing_logs`, `documents`, `concepts`, `concept_prerequisites`, `topic_mastery`,
> `quiz_attempts`, `interaction_events`, `flashcards`, `generated_questions`,
> `generated_artifacts`, `chat_messages`.

---

### 🧠 5. Student-Model CLI Demo (Optional)

Run the standalone command-line simulation for BKT & misconception diagnosis (Engine 2):

```bash
cd backend
# ensure the virtual environment is active
python app/engines/cognitive/run_student_demo.py
```

---

## 📡 API Reference

The backend exposes **9 routers**. All routes are prefixed with `/api`. Full,
always-current documentation is available at
[localhost:8000/docs](http://localhost:8000/docs).

### Authentication - `/api/auth`

Stateless JWT sessions (bearer token in the `Authorization` header). Passwords are
hashed with PBKDF2-SHA256 and tokens signed with HS256 - both use only the Python
standard library, so no extra dependencies are required.

| Method | Endpoint | Description |
|:------:|----------|-------------|
| POST | `/api/auth/signup` | Create an account (name, email, password ≥ 8 chars). Returns a session token. |
| POST | `/api/auth/login` | Email + password sign-in. |
| POST | `/api/auth/google` | Verify a Google ID token, then log in or auto-create the account. |
| GET | `/api/auth/me` | Return the current user for the bearer token. |
| POST | `/api/auth/forgot-password` | Issue a single-use, 1-hour reset token (returned in the response in dev). |
| POST | `/api/auth/reset-password` | Set a new password from a reset token and sign in. |
| POST | `/api/auth/logout` | No-op for stateless JWT (the client discards the token). |

### Sources & Workspaces

| Method | Endpoint | Description |
|:------:|----------|-------------|
| POST | `/api/sources/upload` | Upload documents (PDF, DOCX, PPTX, TXT, MD) - max 50 MB/file, 20 files, 500 MB batch. |
| POST | `/api/sources/paste` | Add pasted text as a source. |
| POST | `/api/sources/website` | Import content from a website URL. |
| GET · POST | `/api/sources/youtube/preview` · `/api/sources/youtube` | Preview and import a YouTube video via transcript. |
| GET | `/api/sources/workspace/{workspace_id}` | List, search, filter, and sort workspace sources. |
| GET | `/api/sources/{id}` | Source details with AI insights. |
| GET | `/api/sources/{id}/status` | Poll processing status and pipeline logs. |
| PATCH | `/api/sources/{id}` | Rename a source. |
| POST | `/api/sources/{id}/reprocess` | Re-run the ingestion pipeline. |
| DELETE | `/api/sources/{id}` | Delete a source. |
| GET · POST | `/api/workspaces` | List / create knowledge workspaces. |
| GET · PATCH | `/api/workspaces/{id}` | Fetch / rename a workspace. |
| GET | `/api/workspaces/{id}/dashboard` | Knowledge metrics, growth, and popular topics. |
| GET | `/api/workspaces/{id}/graph` | Merged workspace knowledge graph. |

### Learning, Generation & Analytics

| Method | Endpoint | Description |
|:------:|----------|-------------|
| POST | `/api/extract` | Run the extraction pipeline to build and cache a graph. |
| POST | `/api/chat` | Send a prompt to the source-grounded Socratic tutor. |
| POST | `/api/chat/answer` | Grade an inline chat quiz answer. |
| GET · DELETE | `/api/chat/history` | Load / clear the signed-in user's chat history for a workspace. |
| POST | `/api/attempt` | Submit a practice attempt to update BKT mastery. |
| POST | `/api/quiz/generate` | Generate a source-grounded quiz for a concept. |
| POST | `/api/quiz/answer` | Grade a quiz answer and update the student model. |
| POST | `/api/quiz/hint` | Request a progressive hint for a quiz question. |
| GET · POST | `/api/flashcards` · `/api/flashcards/review` | Generate flashcards and record spaced-repetition reviews. |
| GET | `/api/flashcards/due` | Flashcards due for review. |
| POST · GET | `/api/generate/material` · `/api/generate/history` | Generate notes/study guides and list past artifacts. |
| GET | `/api/adaptive/recommendation/{student_id}` | The adaptive engine's single best next move. |
| GET | `/api/student` | Student profile, topic progress, and error history. |
| GET | `/api/dashboard/student/{student_id}` | Full analytics summary for the dashboard. |

---

## 🔐 Authentication & Data Isolation

**Per-user data isolation** - every workspace is owned by a user (`workspaces.user_id`),
and all source, graph, chat, quiz, flashcard, and mastery data is scoped to the
authenticated user derived from the bearer token. New users start with a fresh, empty
workspace; the first user to sign in adopts any pre-auth (unowned) workspaces so existing
uploads aren't lost. Chat history, generated quizzes, and generated flashcards persist
per user and survive restarts.

The React app gates every page behind auth: unauthenticated visitors see the
Login / Sign Up / Forgot Password / Reset Password screens, and the session persists
across reloads. Sign out from the account panel at the bottom of the sidebar.

---

## ⚙️ Configuration

Add the following to `backend/.env` (see `backend/.env.example` for the full list):

```env
JWT_SECRET=            # generate: python -c "import secrets; print(secrets.token_hex(32))"
CHAT_MODEL=gpt-oss:120b-cloud
OLLAMA_BASE_URL=       # your Ollama endpoint
GOOGLE_CLIENT_ID=      # OAuth Web client id (optional - enables Google sign-in)
DATABASE_URL=          # optional - omit to use the local SQLite fallback
FRONTEND_URL=http://localhost:5173
```

For the frontend, set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local` to the **same**
client id to enable the "Continue with Google" button.
