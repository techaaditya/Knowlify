import os
from dotenv import load_dotenv

# MUST run before importing other modules so they get the API keys
load_dotenv() 

from parser import parse_pdf
from topic_extractor import extract_topics
from embedder import embed_texts
from graph_builder import build_knowledge_graph

def run_engine_prototype(pdf_path: str):
    print(f"\n🚀 --- ACLS Context Engine Started ---")
    
    print("\n1. Data Acquisition & Chunking...")
    chunks = parse_pdf(pdf_path)
    print(f"   -> Extracted {len(chunks)} chunks.")
    
    print("\n2. Entity & Relationship Extraction (Hybrid KeyBERT + Ollama)...")
    topic_data = extract_topics(chunks)
    topics_list = topic_data.get('topics', [])
    print(f"   -> Extracted {len(topics_list)} canonical concepts.")
    
    print("\n3. Generating Semantic Embeddings (nomic-embed-text)...")
    texts_to_embed = [t.get('description', '') for t in topics_list]
    if texts_to_embed:
        embeddings = embed_texts(texts_to_embed)
        print(f"   -> Generated {len(embeddings)} vectors (Dim: {len(embeddings[0])}).")
    
    print("\n4. Building Knowledge Graph...")
    G = build_knowledge_graph(topics_list)
    print(f"   -> Graph formed with {G.number_of_nodes()} Nodes and {G.number_of_edges()} Edges.")
    
    # Showcase graph relationships
    print("\n==============================================")
    print("      KNOWLEDGE GRAPH TRAVERSAL OUTPUT        ")
    print("==============================================")
    for node in G.nodes(data=True):
        topic_name = node[0]
        data = node[1]
        prereqs = list(G.predecessors(topic_name))
        leads_to = list(G.successors(topic_name))
        
        print(f"\n📘 Concept: {data.get('display_name', topic_name)} (Difficulty: {data.get('difficulty', '?')})")
        print(f"   Desc: {data.get('description', 'No description')}")
        if prereqs:
            print(f"   🔒 Requires knowing: {', '.join(prereqs)}")
        if leads_to:
            print(f"   🔓 Unlocks: {', '.join(leads_to)}")
    print("\n==============================================\n")

if __name__ == "__main__":
    # Ensure Ollama is running on your machine before executing!
    sample_pdf = "sample.pdf" 
    
    if os.path.exists(sample_pdf):
        run_engine_prototype(sample_pdf)
    else:
        print(f"⚠️  ERROR: Please place a PDF file named '{sample_pdf}' in this folder to test the pipeline.")