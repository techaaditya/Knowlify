# Pydantic schemas - User validation
# Defines structures verifying user payloads during API request/response phases.

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: Optional[str] = None
    email: str
    role: Optional[str] = "student"

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
