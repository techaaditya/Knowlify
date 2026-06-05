import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME: str = "Knowlify ACLS API"
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    OLLAMA_API_KEY: str = os.getenv("OLLAMA_API_KEY", "ollama")
    ADAPTIVE_API_KEY: str = os.getenv("ADAPTIVE_API_KEY", "")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./knowlify.db",
    )
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")

settings = Settings()
