"""
Authentication API — email/password + Google sign-in.

Stateless JWT sessions: the client stores the returned token and sends it as
`Authorization: Bearer <token>`. Password hashing and token signing live in
`app.services.security` and use only the standard library.
"""
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..schemas.user import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    UserResponse,
)
from ..services import security
from ..services.auth_deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

_RESET_TTL = timedelta(hours=1)
_GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"


# ── Helpers ─────────────────────────────────────────────────────────────────
def _auth_response(user: User) -> AuthResponse:
    token = security.create_access_token(str(user.id))
    return AuthResponse(token=token, user=UserResponse.model_validate(user))


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=security.hash_password(payload.password),
        auth_provider="email",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    # Uniform error to avoid leaking which emails exist.
    if not user or not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    return _auth_response(user)


@router.post("/google", response_model=AuthResponse)
async def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Verify a Google ID token, then log in or auto-create the account."""
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(_GOOGLE_TOKENINFO, params={"id_token": payload.credential})
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach Google. Try again.")

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential.")

    info = resp.json()
    # Enforce the audience when a client id is configured.
    if settings.GOOGLE_CLIENT_ID and info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google credential was issued for another app.")
    if info.get("email_verified") not in ("true", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your Google email is not verified.")

    email = (info.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account has no email.")

    user = db.query(User).filter(User.email == email).first()
    if user:
        # Link an existing password account to Google on first Google sign-in.
        if info.get("picture") and not user.avatar_url:
            user.avatar_url = info.get("picture")
        db.commit()
        db.refresh(user)
    else:
        user = User(
            name=info.get("name") or email.split("@")[0],
            email=email,
            password_hash="",
            auth_provider="google",
            avatar_url=info.get("picture"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return _auth_response(user)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    generic = "If an account exists for that email, a reset link is on its way."
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Do not disclose whether the email is registered.
        return MessageResponse(message=generic)

    raw, hashed = security.generate_reset_token()
    user.reset_token_hash = hashed
    user.reset_token_expires = datetime.now(timezone.utc) + _RESET_TTL
    db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw}"
    # No email provider is wired up, so surface the token in dev for testing.
    # In production, send `reset_link` by email and drop these fields.
    return MessageResponse(message=generic, reset_token=raw, reset_link=reset_link)


@router.post("/reset-password", response_model=AuthResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    hashed = security.hash_reset_token(payload.token)
    user = db.query(User).filter(User.reset_token_hash == hashed).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid.")

    expires = user.reset_token_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link has expired.")

    user.password_hash = security.hash_password(payload.password)
    user.auth_provider = "email"
    user.reset_token_hash = None
    user.reset_token_expires = None
    db.commit()
    db.refresh(user)
    # Sign the user straight in after a successful reset.
    return _auth_response(user)


@router.post("/logout", response_model=MessageResponse)
def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWT — the client discards the token. Endpoint exists for symmetry.
    return MessageResponse(message="Signed out.")
