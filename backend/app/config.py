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

settings = Settings()
