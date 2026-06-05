# FastAPI Application Entrypoint
# configures middlewares, routes, and bootstraps the HTTP server.

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import documents, chat, quiz, analytics, adaptive, sources, workspaces
from .config import settings
from .database import init_db

app = FastAPI(title=settings.APP_NAME)


@app.on_event("startup")
def on_startup():
    init_db()

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
app.include_router(sources.router)
app.include_router(workspaces.router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to the Knowlify ACLS Engine API server",
        "docs_url": "/docs",
        "status": "active"
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
