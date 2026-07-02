# API Endpoint - Analytics
# Exposes routes delivering student mastery calculations and concept knowledge maps.

import os
from fastapi import APIRouter, HTTPException
from ..engines.cognitive.student_model import StudentModelingEngine

router = APIRouter(prefix="/api", tags=["analytics"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")
@router.get("/student")
async def get_student_data():
    try:
        engine = StudentModelingEngine(data_file=DATA_FILE)
        return engine.students
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading student data: {str(e)}")
