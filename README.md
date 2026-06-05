# 🧠 Knowlify — Adaptive Cognitive Learning System (ACLS)

> An AI-powered adaptive learning platform that transforms raw educational documents into interactive knowledge graphs, tracks student mastery in real-time, and generates personalised study experiences.

---

## 📐 Project Architecture /folder structure

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

## 🚀 How to Run the Project

Follow these steps to run the backend and frontend servers on your local Windows machine.

### 📋 Prerequisites
- **Python 3.11+** (Make sure Python is added to your system PATH)
- **Node.js 18+** (Includes `npm`)
- **Ollama** running locally (Optional, falls back to heuristic keyword extraction if not running)

---

### 🐍 1. Running the Backend (FastAPI)

Choose the setup instructions corresponding to the shell you are using:

#### Option A: Using Windows PowerShell or Command Prompt (CMD)
1. Navigate into the `backend` directory:
   ```powershell
   cd backend
   ```
2. Activate the pre-configured virtual environment:
   * **PowerShell**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **Command Prompt (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
3. Run the FastAPI development server:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```

#### Option B: Using Git Bash
1. Navigate into the `backend` directory:
   ```bash
   cd backend
   ```
2. Activate the pre-configured virtual environment:
   ```bash
   source venv/Scripts/activate
   ```
3. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

> [!NOTE]
> The backend server will run at [http://localhost:8000](http://localhost:8000). You can check the interactive Swagger documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 🧠 2. Running the Student Modeling Engine Demo (Optional CLI Demo)
If you want to run the standalone command-line diagnostic simulation for the BKT & Misconception Diagnosis (Engine 2):
1. Navigate to the cognitive engine directory:
   ```bash
   cd backend
   # Ensure environment is active (e.g., source venv/Scripts/activate)
   python app/engines/cognitive/run_student_demo.py
   ```

---

### ⚛️ 3. Running the Frontend (React + Vite)

1. Open a **new terminal tab or window** and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the node packages (if not already done):
   ```bash
   npm install
   ```
3. Launch the React development server:
   ```bash
   npm run dev
   ```

> [!NOTE]
> The React development server will start at [http://localhost:5173](http://localhost:5173). It communicates with the backend API on port `8000` automatically.

---

### 🐳 4. Running via Docker-Compose (Full Stack)
If you prefer running both servers along with a PostgreSQL and Redis database in containers:
```bash
docker-compose up --build
```

---

## 🧠 The 5 AI Engines

| Engine | Name | Description | Status |
|--------|------|-------------|--------|
| **1** | **Context Engine** | Multi-source ingestion (PDF, DOCX, PPTX, web, YouTube, notes) → GraphRAG pipeline with NetworkX and KeyBERT. | ✅ Built |
| **2** | **Cognitive Engine** | Tracks student mastery state and diagnoses repeated misconceptions. | ✅ Built |
| **3** | **Adaptive Engine** | Calculates intervals via SM-2 spaced repetition & validates prerequisites. | 🔧 Stub |
| **4** | **Generative Engine** | Auto-generates Socratic questions and quiz flashcard sets. | 🔧 Stub |
| **5** | **Analytics Engine** | Processes dashboard radar charts and mastery metrics. | 🔧 Stub |

---

## 📡 API Endpoints

### Knowledge Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/sources/upload` | Upload documents (PDF, DOCX, PPTX, TXT, MD) — max 50 MB/file, 20 files, 500 MB batch |
| **POST** | `/api/sources/paste` | Add pasted text as a knowledge source |
| **POST** | `/api/sources/website` | Import content from a website URL |
| **POST** | `/api/sources/youtube` | Import YouTube video via transcript |
| **GET** | `/api/sources/{id}` | Get source details with AI insights |
| **GET** | `/api/sources/{id}/status` | Poll processing status and pipeline logs |
| **GET** | `/api/sources/workspace/{workspace_id}` | List, search, filter, and sort workspace sources |
| **PATCH** | `/api/sources/{id}` | Rename a source |
| **POST** | `/api/sources/{id}/reprocess` | Re-run the ingestion pipeline |
| **DELETE** | `/api/sources/{id}` | Delete a source |
| **GET** | `/api/workspaces` | List knowledge workspaces |
| **GET** | `/api/workspaces/{id}/dashboard` | Knowledge metrics, growth, and popular topics |
| **GET** | `/api/workspaces/{id}/graph` | Merged workspace knowledge graph |

### Learning & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/api/student` | Retrieve student profile, topic progress, and error history. |
| **GET** | `/api/graph` | Fetch the structured knowledge graph nodes & edges (Calculus or fallback). |
| **POST** | `/api/attempt` | Submit a practice attempt to calculate BKT mastery updates. |
| **POST** | `/api/extract` | Run the PDF extraction pipeline to generate and cache new graphs. |
| **POST** | `/api/chat` | Send a prompt to the Socratic tutoring model. |

---

## 🗂️ Branch: `Aaditya`
