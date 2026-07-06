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

## 🚀 How to Run the Project

Follow these steps to run the backend and frontend servers on your local Windows machine.

### 📋 Prerequisites
- **Python 3.11+** (Make sure Python is added to your system PATH)
- **Node.js 18+** (Includes `npm`)
- **Ollama** running locally. Follow these steps to set it up:
  1. **Start the Ollama Daemon:** Ensure Ollama is running on your machine. You can start it via the desktop app icon (which sits in your system tray) or by running:
     ```powershell
     ollama serve
     ```
  2. **Download Models (First Time Only):** You only need to run the pull commands once. Once downloaded, the models are cached locally:
     ```powershell
     ollama pull nomic-embed-text
     ollama pull gpt-oss:120b-cloud
     ```
  3. **Leave it active:** Keep the Ollama application or daemon running in the background whenever you run the FastAPI backend.

> [!NOTE]
> **Hugging Face Hub (`HF_TOKEN`) Warning:** When starting the backend, you might see a warning: *\"You are sending unauthenticated requests to the HF Hub... Please set a HF_TOKEN...\"*
> This is a standard notice from Hugging Face's `huggingface_hub` package which is used by KeyBERT to download model weights (`all-MiniLM-L6-v2`) locally. It is **completely harmless** and can be ignored. You do not need to configure any HF token.

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

### 🐘 5. Setting Up PostgreSQL (Local Database)

By default the backend falls back to a local **SQLite** file (`knowlify.db`) if PostgreSQL is unavailable.
To use the full PostgreSQL database, follow these steps:

#### Step 1: Install PostgreSQL
1. Download the installer from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the wizard:
   - **Remember the password** you set for the `postgres` superuser — you'll need it for the `.env` file.
   - Keep the default port **5432**.
   - When prompted for components, include **pgAdmin 4** (optional but useful).
3. After installation, make sure the PostgreSQL service is running:
   ```powershell
   Get-Service -Name "postgresql*"
   # Should show Status = Running
   ```

#### Step 2: Install the Python Driver
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install psycopg2-binary
```

#### Step 3: Configure `.env`
Open `backend/.env` and set `DATABASE_URL` with your actual postgres password:
```env
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/knowlify
```

#### Step 4: Run the Setup Script
```powershell
cd backend
python setup_postgres.py
```
This will:
- ✅ Connect to PostgreSQL
- ✅ Create the `knowlify` database
- ✅ Enable the `uuid-ossp` extension
- ✅ Create all 13 tables automatically

#### Step 5: Verify
Start the backend and look for the log line:
```
[database] Initialised 13 tables on postgresql
```
If you see `on sqlite` instead, double-check that `psycopg2-binary` is installed and your password is correct.

> [!NOTE]
> **Database Schema:** The PostgreSQL schema includes 13 tables:
> `workspaces`, `sources`, `source_chunks`, `processing_logs`, `users`, `documents`,
> `concepts`, `concept_prerequisites`, `topic_mastery`, `quiz_attempts`,
> `interaction_events`, `flashcards`, `chat_messages`

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

### Authentication

Stateless JWT sessions (bearer token in the `Authorization` header). Passwords
are hashed with PBKDF2-SHA256 and tokens signed with HS256 — both use only the
Python standard library, so no extra dependencies are required.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/auth/signup` | Create an account (full name, email, password ≥ 8 chars). Returns a session token. |
| **POST** | `/api/auth/login` | Email + password sign-in. |
| **POST** | `/api/auth/google` | Verify a Google ID token, then log in or auto-create the account. |
| **GET** | `/api/auth/me` | Return the current user for the bearer token. |
| **POST** | `/api/auth/forgot-password` | Issue a single-use, 1-hour password reset token (dev returns it in the response). |
| **POST** | `/api/auth/reset-password` | Set a new password from a reset token and sign in. |
| **POST** | `/api/auth/logout` | No-op for stateless JWT (client discards the token). |
| **GET** | `/api/chat/history` | Load the signed-in user's saved chat turns for a workspace. |
| **DELETE** | `/api/chat/history` | Clear the signed-in user's chat history for a workspace. |

**Per-user data isolation** — every workspace is owned by a user (`workspaces.user_id`),
and all source, graph, chat, quiz, flashcard, and mastery data is scoped to the
authenticated user derived from the bearer token. New users start with a fresh empty
workspace; the first user to sign in adopts any pre-auth (unowned) workspaces so
existing uploads aren't lost. Chat history, generated quizzes, and generated flashcards
are persisted per user and survive restarts.

**Configuration** — add to `backend/.env` (see `.env.example`):

```env
JWT_SECRET=            # generate: python -c "import secrets; print(secrets.token_hex(32))"
GOOGLE_CLIENT_ID=      # OAuth Web client id (optional — enables Google sign-in)
FRONTEND_URL=http://localhost:5173
```

For the frontend, set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local` to the
**same** client id to enable the "Continue with Google" button.

The React app gates all existing pages behind auth: unauthenticated visitors see
the Login / Sign Up / Forgot Password / Reset Password screens, and the session
persists across reloads. Sign out from the account panel at the bottom of the sidebar.

---

## 🗂️ Branch: `Aaditya`
