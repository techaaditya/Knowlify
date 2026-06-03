# API Endpoint - Analytics
# Exposes routes delivering student mastery calculations and concept knowledge maps.

import os
import json
from fastapi import APIRouter, HTTPException, Query
from ..engines.cognitive.student_model import StudentModelingEngine
from .documents import generate_pdf_graph

router = APIRouter(prefix="/api", tags=["analytics"])

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(_HERE, "..", "student_data.json")
CACHE_FILE = os.path.join(_HERE, "..", "extracted_graph_cache.json")

CALCULUS_GRAPH = {
    "nodes": [
        {
            "id": "Limits",
            "display_name": "Limits & Continuity",
            "description": "Understanding the behavior of functions as they approach a specific point. Foundations of calculus.",
            "difficulty": 1,
            "prerequisites": []
        },
        {
            "id": "Derivatives",
            "display_name": "Derivatives & Rate of Change",
            "description": "Measuring how a function changes as its input changes. Represents slopes, speeds, and rates of change.",
            "difficulty": 2,
            "prerequisites": ["Limits"]
        },
        {
            "id": "Chain Rule",
            "display_name": "The Chain Rule",
            "description": "A mathematical formula for computing the derivative of the composition of two or more functions.",
            "difficulty": 3,
            "prerequisites": ["Derivatives"]
        },
        {
            "id": "Integrals",
            "display_name": "Integrals & Area Under Curve",
            "description": "The reverse operation of derivatives. Computes the accumulation of quantities, volumes, and areas.",
            "difficulty": 4,
            "prerequisites": ["Limits", "Derivatives"]
        },
        {
            "id": "Fundamental Theorem",
            "display_name": "Fundamental Theorem of Calculus",
            "description": "The beautiful connection linking differentiation with integration, forming the core of calculus.",
            "difficulty": 4,
            "prerequisites": ["Integrals", "Chain Rule"]
        }
    ],
    "edges": [
        {"from": "Limits", "to": "Derivatives"},
        {"from": "Derivatives", "to": "Chain Rule"},
        {"from": "Limits", "to": "Integrals"},
        {"from": "Derivatives", "to": "Integrals"},
        {"from": "Integrals", "to": "Fundamental Theorem"},
        {"from": "Chain Rule", "to": "Fundamental Theorem"}
    ]
}

def seed_default_student(engine: StudentModelingEngine):
    engine.create_student("S001", "Alex Johnson")
    # Record default attempts to make it look active
    engine.record_attempt("S001", "Limits", "Q1", is_correct=True, hints_used=0, time_taken=40)
    engine.record_attempt("S001", "Limits", "Q2", is_correct=True, hints_used=1, time_taken=55)
    engine.record_attempt("S001", "Limits", "Q3", is_correct=False, error_type="Sign error", hints_used=2, time_taken=80)
    engine.record_attempt("S001", "Derivatives", "Q4", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=90)
    engine.record_attempt("S001", "Derivatives", "Q5", is_correct=False, error_type="Formula mistake", hints_used=1, time_taken=85)
    engine.record_attempt("S001", "Derivatives", "Q6", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=95)
    engine.record_attempt("S001", "Derivatives", "Q7", is_correct=True, hints_used=1, time_taken=70)
    engine.save_data()

@router.get("/student")
async def get_student_data():
    try:
        engine = StudentModelingEngine(data_file=DATA_FILE)
        if not engine.students:
            seed_default_student(engine)
        return engine.students
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading student data: {str(e)}")

@router.get("/graph")
async def get_graph(course: str = Query("Calculus")):
    if course == "Calculus":
        return CALCULUS_GRAPH
        
    # Voice Banking Paper - Load from cache or run pipeline
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                graph_data = json.load(f)
            return graph_data
        except Exception as e:
            pass
            
    # Fallback/Generate graph from sample.pdf
    _here = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(_here, "..", "sample.pdf"),
        os.path.join(_here, "..", "..", "sample.pdf"),
        os.path.join(_here, "..", "..", "..", "sample.pdf"),
        "sample.pdf",
    ]
    
    pdf_path = None
    for path in possible_paths:
        if os.path.exists(path):
            pdf_path = path
            break
            
    if not pdf_path:
        # If sample.pdf is not found, return empty placeholder structure rather than crash
        return {"nodes": [], "edges": []}
        
    try:
        graph_data = generate_pdf_graph(pdf_path)
        return graph_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate graph: {str(e)}")
