"""
Authentication primitives — dependency-free password hashing and JWT.

Uses only the Python standard library so the backend runs identically on
Windows/PostgreSQL and the SQLite fallback without native build steps:
  - Passwords: PBKDF2-HMAC-SHA256 with a per-user random salt.
  - Tokens:    compact HS256 JSON Web Tokens signed with the app secret.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Optional

from ..config import settings

# ── Password hashing ────────────────────────────────────────────────────────
_PBKDF2_ITERATIONS = 260_000
_PBKDF2_ALGO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    """Return a self-describing hash: pbkdf2_sha256$iterations$salt$hash."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    )
    return f"{_PBKDF2_ALGO}${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    """Constant-time verification against a stored PBKDF2 hash."""
    if not stored or stored.count("$") != 3:
        return False
    algo, iterations, salt, expected = stored.split("$")
    if algo != _PBKDF2_ALGO:
        return False
    try:
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
        )
    except ValueError:
        return False
    return hmac.compare_digest(digest.hex(), expected)


# ── JSON Web Tokens (HS256) ─────────────────────────────────────────────────
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def _sign(message: str) -> str:
    signature = hmac.new(
        settings.JWT_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).digest()
    return _b64url_encode(signature)


def create_access_token(subject: str, extra: Optional[dict[str, Any]] = None) -> str:
    """Sign a JWT for the given subject (user id) with the configured lifetime."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + settings.JWT_EXPIRE_SECONDS,
    }
    if extra:
        payload.update(extra)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    return f"{signing_input}.{_sign(signing_input)}"


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Return the payload if the token is well-formed, signed, and unexpired."""
    if not token or token.count(".") != 2:
        return None
    header_b64, payload_b64, signature = token.split(".")
    signing_input = f"{header_b64}.{payload_b64}"
    if not hmac.compare_digest(signature, _sign(signing_input)):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload


# ── Password reset tokens ───────────────────────────────────────────────────
def generate_reset_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Only the hash is persisted."""
    raw = secrets.token_urlsafe(32)
    return raw, hashlib.sha256(raw.encode("utf-8")).hexdigest()


def hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
