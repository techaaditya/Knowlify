# FastAPI Application Entrypoint
# configures middlewares, routes, and bootstraps the HTTP server.

import threading
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import adaptive, analytics, chat, dashboard, documents, quiz, sources, workspaces

app = FastAPI(title=settings.APP_NAME)

# Enable CORS for frontend cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(analytics.router)
app.include_router(adaptive.router)
app.include_router(dashboard.router)
app.include_router(sources.router)
app.include_router(workspaces.router)


@app.on_event("startup")
async def startup_event():
    """Pre-warm heavy models in a background thread so the first request isn't slow."""
    from .database import init_db
    init_db()

    def _prewarm_keybert():
        try:
            from .engines.context.topic_extractor import get_kw_model
            get_kw_model()
            print("[startup] KeyBERT model pre-warmed successfully.")
        except Exception as e:
            print(f"[startup] KeyBERT pre-warm skipped: {e}")

    thread = threading.Thread(target=_prewarm_keybert, daemon=True)
    thread.start()


@app.get("/")
async def root():
    return {
        "message": "Welcome to the Knowlify ACLS Engine API server",
        "docs_url": "/docs",
        "status": "active",
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
