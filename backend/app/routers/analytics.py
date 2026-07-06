# API Endpoint - Analytics
# Exposes routes delivering student mastery calculations and concept knowledge maps.

import os
from fastapi import APIRouter, Depends, HTTPException
from ..engines.cognitive.student_model import StudentModelingEngine
from ..models.user import User
from ..services.auth_deps import get_current_user

router = APIRouter(prefix="/api", tags=["analytics"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")


@router.get("/student")
async def get_student_data(current_user: User = Depends(get_current_user)):
    """Return only the authenticated learner's profile, keyed by their id."""
    try:
        engine = StudentModelingEngine(data_file=DATA_FILE)
        sid = str(current_user.id)
        profile = engine.students.get(sid)
        return {sid: profile} if profile else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading student data: {str(e)}")
