from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from ..database import Base
from .types import GUID, new_uuid


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
