# ACLS: Content & Knowledge Graph Engine
## Comprehensive Implementation & Architecture Guide

This document provides a deep dive into **Engine 1** of the Adaptive Cognitive Learning System (ACLS). This engine is responsible for ingesting unstructured study materials (like PDFs), understanding the core concepts within them, and mapping them into a structured **Knowledge Graph**. 

---

## 1. Essential Concepts

Before diving into the code, it is crucial to understand the underlying data science and NLP concepts that power this engine.

### 1.1. Semantic Chunking
Reading an entire textbook at once is impossible for an AI due to context window limits. **Chunking** is the process of breaking a document into smaller pieces. Instead of arbitrarily cutting text every 1,000 characters (which might cut a sentence in half), we use **Recursive Character Chunking**. This respects natural paragraph and sentence boundaries, ensuring that each chunk contains a complete thought.

### 1.2. Hybrid Entity Extraction (KeyBERT + LLM)
Extracting concepts from text purely via an LLM can lead to hallucinations (the AI making things up). To ground the AI, we use a hybrid approach:
*   **KeyBERT:** A local, fast machine learning model that extracts exact keywords directly from the text using embeddings.
*   **LLM (GPT-4o-mini):** We feed the KeyBERT keywords into the LLM. The LLM acts as an intelligent organizer, grouping raw keywords into formal educational concepts.

### 1.3. Entity Resolution
In textbooks, "Derivatives", "finding the derivative", and "calculating derivatives" are the exact same concept. **Entity Resolution** is the process of prompting the LLM to recognize these synonyms and merge them under one canonical (standardized) name: `derivatives`.

### 1.4. Directed Knowledge Graphs
A Knowledge Graph is a web of data where **Nodes** are entities (topics) and **Edges** are relationships. For ACLS, the graph is **Directed**, meaning the relationships flow in a specific direction (e.g., `Limits` $\rightarrow$ `Derivatives`). This specific relationship is defined as a `prerequisite`.

### 1.5. Vector Embeddings
An embedding is a translation of text into a high-dimensional mathematical array (a vector). If two concepts have similar meanings, their vectors will be close together in space. This is what allows the ACLS Chatbot to instantly find the right paragraph to answer a student's question (a process called RAG - Retrieval-Augmented Generation).

---

## 2. Codebase Walkthrough

The prototype is split into five distinct Python files, representing a clean data pipeline.

### `parser.py` (Data Acquisition)
**Goal:** Extract text from a PDF and break it down into digestible pieces.
*   **Libraries used:** `PyMuPDF` (fastest/most accurate PDF parser), `langchain.text_splitter`.
*   **How it works:** It opens the PDF, reads page by page, cleans up weird formatting (like stray page numbers), and uses LangChain's `RecursiveCharacterTextSplitter` to safely divide the text into ~1024-character chunks without breaking sentences. 

### `topic_extractor.py` (Intelligence Layer)
**Goal:** Figure out what topics are in the text and how they relate.
*   **Libraries used:** `keybert`, `openai`.
*   **How it works:** It first runs KeyBERT over the chunks to pull out the most mathematically significant words. It then sends those words to OpenAI with a strict prompt: *"Group these into official topics, determine their difficulty, and tell me which topics are prerequisites for others. Return ONLY JSON."*

### `embedder.py` (Memory Preparation)
**Goal:** Convert concepts into mathematical vectors for future search.
*   **Libraries used:** `openai`, `numpy`.
*   **How it works:** It takes the description of every topic found by the `topic_extractor` and sends it to OpenAI's `text-embedding-3-small` model. It returns an array of 1,536 numbers. It also includes a `cosine_similarity` function, which calculates how closely related two vectors are.

### `graph_builder.py` (Structuring)
**Goal:** Build the actual map of knowledge.
*   **Libraries used:** `networkx`, `neo4j` (for production).
*   **How it works:** It uses NetworkX to create an in-memory graph. It loops through the topics, adding them as "Nodes". Then, it loops through the prerequisites and draws arrows ("Edges") between the nodes. It also includes the code needed to export this map to a Neo4j Enterprise Database when you are ready to scale.

### `pipeline.py` (The Orchestrator)
**Goal:** Run the entire system from start to finish.
*   **How it works:** This is the main execution script. It strings the previous four files together. It takes a PDF path, parses it, extracts the topics, embeds them, builds the graph, and finally prints a beautiful, human-readable summary to the terminal.

### `student_model.py` (Student Modeling Engine)
**Goal:** Track student progress, calculate mastery scores, and detect specific cognitive misconceptions.
*   **How it works:** This file contains the `StudentModelingEngine` class. It manages student profiles, records quiz/practice attempts, and applies scoring logic (like penalizing for hint usage). It analyzes `error_types` across attempts—if a student repeats the same error multiple times (e.g., three "Formula mistakes"), it flags a persistent misconception to guide future intervention.

### `run_student_demo.py` (Modeling Simulation)
**Goal:** Demonstrate the analytical power of the Student Modeling Engine.
*   **How it works:** It acts as a simulation script that initializes a test student and mimics two quiz sessions ("Limits" and "Derivatives"). It feeds success/failure rates, hint usage, and error types into the engine, and then prints out a "Diagnostic Report" and "Adaptive Engine Signals" recommending the next best pedagogical actions.

### `student_data.json` (Local Data Store)
**Goal:** Persist the student profiles and historical data.
*   **How it works:** A local JSON database maintained by the `StudentModelingEngine` to save student history and mastery states across different sessions.

---

## 3. How to Show a Working Demo

To impress your supervisors or stakeholders, follow this exact script to set up and present the demo.

### Step 1: Preparation (Do this before the presentation)
1. Create a project folder and set up a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate