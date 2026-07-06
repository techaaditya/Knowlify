"""
Shared authentication dependencies.

`get_current_user` enforces a valid session; `get_optional_user` resolves the
bearer token when present but never blocks the request. Because the frontend
sends `Authorization: Bearer <jwt>` on every call, these let any router derive
the acting user — the basis for per-user data isolation.
"""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from . import security


def _user_from_authorization(authorization: str | None, db: Session) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = security.decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    return db.query(User).filter(User.id == payload["sub"]).first()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the bearer token to a User or raise 401."""
    user = _user_from_authorization(authorization, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please sign in again.",
        )
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Resolve the bearer token to a User, or None when absent/invalid."""
    return _user_from_authorization(authorization, db)


def effective_student_id(current_user: User | None, fallback: str) -> str:
    """The authenticated user's id is the source of truth for the student model.

    Falls back to the client-supplied id only for unauthenticated/legacy calls,
    which prevents one user's attempts from landing in another's profile.
    """
    return str(current_user.id) if current_user else fallback
