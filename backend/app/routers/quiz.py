# API Endpoint - Quiz
# Exposes routes handling simulated student test attempts and diagnostic calculations.

import os
from fastapi import APIRouter, HTTPException
from ..schemas.quiz import QuizAttemptCreate
from ..engines.cognitive.student_model import StudentModelingEngine

router = APIRouter(prefix="/api", tags=["quiz"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")

@router.post("/attempt")
async def record_attempt(payload: QuizAttemptCreate):
    try:
        engine = StudentModelingEngine(data_file=DATA_FILE)
        
        if payload.student_id not in engine.students:
            engine.create_student(payload.student_id, "Alex Johnson")
            
        engine.record_attempt(
            payload.student_id,
            payload.topic_name,
            payload.question_id,
            payload.is_correct,
            payload.error_type,
            payload.hints_used,
            payload.time_taken
        )
        engine.save_data()
        
        # Pull signals
        student = engine.get_student(payload.student_id)
        recommendation = engine.get_recommendation_signal(payload.student_id, payload.topic_name)
        weak_topics = engine.get_weak_topics(payload.student_id)
        misconceptions = engine.detect_misconceptions(payload.student_id)
        
        return {
            "success": True,
            "student": student,
            "recommendation": recommendation,
            "weak_topics": weak_topics,
            "misconceptions": misconceptions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
