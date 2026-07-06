# Pydantic schemas — Authentication payloads
# Request/response contracts for the /api/auth endpoints.

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Pragmatic email pattern — dependency-free (avoids the email-validator extra).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: str) -> str:
    value = (value or "").strip().lower()
    if not _EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address.")
    return value


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required.")
        return v

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        return _normalize_email(v)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        return _normalize_email(v)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., description="Google Identity Services ID token")


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        return _normalize_email(v)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=8)
    password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None
    auth_provider: str
    created_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, v):
        return str(v)

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
    # Populated in dev only so password resets are testable without email.
    reset_token: Optional[str] = None
    reset_link: Optional[str] = None
