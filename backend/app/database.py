import os
import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger(__name__)

_db_url = settings.DATABASE_URL
_connect_args = {}
_using_postgres = False

if _db_url.startswith("postgresql"):
    try:
        import psycopg2  # noqa: F401
        _using_postgres = True
        logger.info("[database] psycopg2 found – connecting to PostgreSQL")
    except ImportError:
        logger.warning(
            "[database] psycopg2 not installed – falling back to SQLite. "
            "Run: pip install psycopg2-binary"
        )
        _db_url = "sqlite:///./knowlify.db"

if _db_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(_db_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enable WAL mode for SQLite for better concurrent access
if _db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Import every model module so SQLAlchemy registers them, then create all tables."""
    # Core models (already existed)
    from .models import workspace, source  # noqa: F401
    # New models (PostgreSQL schema)
    from .models import user, document, student_profile  # noqa: F401

    Base.metadata.create_all(bind=engine)

    dialect = engine.dialect.name
    table_count = len(Base.metadata.tables)
    logger.info(f"[database] init_db complete – dialect={dialect}, tables={table_count}")
    print(f"[database] Initialised {table_count} tables on {dialect}")
