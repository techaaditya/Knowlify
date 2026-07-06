from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from ..database import Base
from .types import GUID, new_uuid


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    name = Column(String(120), nullable=False, default="")
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False, default="")
    # 'email' for password accounts, 'google' for federated sign-in.
    auth_provider = Column(String(20), nullable=False, default="email")
    avatar_url = Column(String(512), nullable=True)
    # Hashed, single-use password-reset token and its expiry.
    reset_token_hash = Column(String(64), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
