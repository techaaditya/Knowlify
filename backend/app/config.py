import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME: str = "Knowlify ACLS API"
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    OLLAMA_API_KEY: str = os.getenv("OLLAMA_API_KEY", "ollama")
    CHAT_API_KEY: str = os.getenv("CHAT_API_KEY", os.getenv("OLLAMA_API_KEY", "ollama"))
    CHATBOT_API_KEY: str = os.getenv("CHATBOT_API_KEY", "")
    CHAT_MODEL: str = os.getenv("CHAT_MODEL", "gpt-oss:120b-cloud")
    CHAT_FALLBACK_MODEL: str = os.getenv("CHAT_FALLBACK_MODEL", "llama3.2:3b")
    ADAPTIVE_API_KEY: str = os.getenv("ADAPTIVE_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/knowlify")
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # Authentication
    # A stable random secret is generated per-process if none is provided, so
    # local dev works out of the box. Set JWT_SECRET in production so tokens
    # survive restarts.
    JWT_SECRET: str = os.getenv("JWT_SECRET", "") or __import__("secrets").token_hex(32)
    JWT_EXPIRE_SECONDS: int = int(os.getenv("JWT_EXPIRE_SECONDS", 60 * 60 * 24 * 7))  # 7 days
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    # Where the frontend is served — used to build password-reset links.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

settings = Settings()
