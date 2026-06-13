import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

_db_url = settings.DATABASE_URL
_connect_args = {}

if _db_url.startswith("postgresql"):
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        _db_url = "sqlite:///./knowlify.db"

if _db_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(_db_url, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from .models import workspace, source  # noqa: F401

    Base.metadata.create_all(bind=engine)
