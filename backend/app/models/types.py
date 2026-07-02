"""
Shared column types and helpers for dialect-safe models.
Works on both PostgreSQL (native UUID, gen_random_uuid) and SQLite (CHAR(32), Python uuid).
"""
import uuid
from sqlalchemy import String, text
from sqlalchemy.types import TypeDecorator, CHAR


class GUID(TypeDecorator):
    """
    Platform-independent GUID type.
    - Uses PostgreSQL's native UUID type when available.
    - Falls back to CHAR(36) on other dialects (e.g. SQLite).
    """
    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value


def new_uuid():
    """Generate a new UUID string for use as a default."""
    return str(uuid.uuid4())
