# API Endpoint - Documents
# Exposes routes handling PDF document parsing and knowledge extraction.

import os
import json
from fastapi import APIRouter, HTTPException
from ..engines.context.pipeline import run_engine_prototype

router = APIRouter(prefix="/api", tags=["documents"])

_HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(_HERE, "..", "extracted_graph_cache.json")

def generate_pdf_graph(pdf_path: str):
    try:
        # Run the engine prototype
        G, topics_list = run_engine_prototype(pdf_path)
        
        # Form network structure for Vis.js
        nodes = []
        for node in G.nodes(data=True):
            nodes.append({
                "id": node[0],
                "display_name": node[1].get("display_name", node[0]),
                "description": node[1].get("description", "No description"),
                "difficulty": node[1].get("difficulty", 1),
                "prerequisites": list(G.predecessors(node[0]))
            })
            
        edges = []
        for edge in G.edges(data=True):
            edges.append({
                "from": edge[0],
                "to": edge[1]
            })

        graph_data = {
            "nodes": nodes,
            "edges": edges
        }

        # Cache the graph
        with open(CACHE_FILE, "w") as f:
            json.dump(graph_data, f, indent=4)

        return graph_data
    except Exception as e:
        print(f"Error during graph generation: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@router.post("/extract")
async def extract_document():
    # Resolves paths robustly
    # Resolve sample.pdf — check backend/app/ first (where we copied it), then project root
    _here = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(_here, "..", "sample.pdf"),          # backend/app/sample.pdf
        os.path.join(_here, "..", "..", "sample.pdf"),    # backend/sample.pdf
        os.path.join(_here, "..", "..", "..", "sample.pdf"),  # project root
        "sample.pdf",
    ]
    
    pdf_path = None
    for path in possible_paths:
        if os.path.exists(path):
            pdf_path = path
            break
            
    if not pdf_path:
        raise HTTPException(
            status_code=404, 
            detail="sample.pdf not found in workspace. Please verify its location."
        )
        
    try:
        print(f"\n⚙️ API Triggered Knowledge Graph Construction for {pdf_path}...")
        graph_data = generate_pdf_graph(pdf_path)
        return graph_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
