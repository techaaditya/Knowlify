# Comprehensive Documentation of the Knowlify / ACLS Engine

Welcome to the detailed documentation for the **Adaptive Cognitive Learning System (ACLS)** Engine. This guide provides a conceptual overview of everything you need to know about the system, followed by a meticulous **line-by-line code explanation** for every single file in the workspace.

---

## 1. The Basics You Need to Know (Core Concepts)

Before reading the code, here are the foundational computer science and NLP (Natural Language Processing) concepts driving this system:

1. **Semantic Chunking:** Language Models cannot process an entire textbook simultaneously due to input limits. We use **Recursive Character Chunking** to break large PDF texts down into smaller paragraphs/sentences safely without dividing thoughts in half.
2. **Hybrid Entity Extraction:** Pulling concepts completely via an AI model frequently causes "hallucinations" (the AI hallucinating facts). We use **KeyBERT** (a local, mathematically strict model) to pull absolute key phrases out of texts and then hand those isolated facts to an **LLM (like GPT/Ollama)** to map them into formalized "Topics."
3. **Entity Resolution:** The process of taking variations of a concept (e.g., "Finding limits", "Calculating the limit", "Limits") and assigning them one unified master name (i.e., `limits`).
4. **Knowledge Graphs (Directed):** This system maps learning conceptually. Topics form **Nodes**. Relationships form **Edges**. If "Topic A" is required to understand "Topic B," this is drawn as a one-way `prerequisite` arrow (directed graph).
5. **Vector Embeddings (nomic-embed-text):** The AI cannot understand English; it understands math. An embedder translates paragraphs of text into lists of thousands of numerical coordinates (vectors). Topics with similar vectors represent similar concepts. 
6. **Student Cognitive Modeling:** The system tracks user performance. By recording right/wrong attempts, time spent, and hint usages, it dynamically shifts their topic's "Mastery Score" and detects recurring misconceptions.

---

## 2. File-by-File & Line-by-Line Breakdown

Here is the explanation for every single line of code in the system.

### A. parser.py (Data Ingestion & Chunking)
This file extracts text from a PDF and safely slices it.

```python
import fitz  # PyMuPDF
import re
from typing import List, Dict
from langchain_text_splitters import RecursiveCharacterTextSplitter
```
* **Line 1:** Imports `fitz` via PyMuPDF, which is a lightning-fast library designed to open and rip text out of PDF files.
* **Line 2:** Imports `re` (Regular Expressions), a core Python module used for locating specific patterns of text (like messy spaces or characters).
* **Line 3:** Imports `List` and `Dict` to use type-hinting, ensuring functions specify they take or return lists and dictionaries, which prevents bugs.
* **Line 4:** Imports LangChain's intelligent text divider that cuts text at structured grammatical boundaries.

```python
def clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\b\d+\b(?=\s*$)', '', text)
    return text.strip()
```
* **Line 6:** Defines a function `clean_text` that intakes a string and returns a string.
* **Line 7:** Uses `re.sub` to find any instances of one or more consecutive whitespaces (tabs, newlines, wide spaces) and replace them with a simple single space.
* **Line 8:** Uses `re.sub` to locate any isolated numbers (often lingering page numbers retrieved at the very bottom of the page) and purges them.
* **Line 9:** Returns the text, stripping away any extra invisible trailing/leading characters from the exterior.

```python
def parse_pdf(filepath: str) -> List[Dict]:
    doc = fitz.open(filepath)
    chunks = []
    chunk_id = 0
```
* **Line 11:** Starts the main function `parse_pdf`, dictating it requires a file path string and returns a big list of parameter dictionaries.
* **Line 12:** Instructs PyMuPDF to physically open the document into memory.
* **Line 13:** Readies an empty Python list (`[]`) where we will place our completed text slices.
* **Line 14:** Initializes an ID counter at 0 to uniquely name every slice.

```python
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1024,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
```
* **Line 16-21:** Sets up the AI slicing tool. It limits slices to a maximum of `1024` letters per slice, configures `100` characters of overlap (so chunks maintain context instead of a hard cut), and informs the splitter to attempt cutting at new paragraphs first (`\n\n`), then sentences (`. `) down to basic spaces if forced to.

```python
    for page_num, page in enumerate(doc):
        text = clean_text(page.get_text('text'))
        if not text:
            continue
```
* **Line 23:** Iterates over every page inside the opened PDF index.
* **Line 24:** Uses `.get_text('text')` to scrape raw letters from the page layout and instantly passes it through our `clean_text` filter.
* **Line 25-26:** Scrutinizes if the page was a blank graphic. If `text` is completely empty, it uses `continue` to skip immediately to the next page loop.

```python
        page_chunks = splitter.split_text(text)
        for pc in page_chunks:
            chunks.append({
                'chunk_id': f'chunk_{chunk_id}',
                'page': page_num + 1,
                'text': pc,
                'char_count': len(pc)
            })
            chunk_id += 1
            
    return chunks
```
* **Line 28:** Feeds the cleaned unbroken page text into the initialized LangChain `splitter`.
* **Line 29:** Iterates through every resulting slice produced across that page.
* **Line 30-35:** Assembles a dictionary bundle mapping metadata (the chunk's unique name `chunk_id`, the exact integer `page` number (+1 so it isn't 0-indexed), the literal `text`, and length metrics `char_count`) and slots it inside our master `chunks` list.
* **Line 36:** Increases the chunk counter digits by 1.
* **Line 38:** Finalizes the function returning all accumulated chunk data. 

### B. topic_extractor.py (The Intelligence Layer)
Uses statistical models to pull keywords, then dictates to a large language model to organize topics mapping structural logic.

```python
from keybert import KeyBERT
from openai import OpenAI
import json
import os

kw_model = KeyBERT() 
```
* **Line 1-4:** Imports required engines. `KeyBERT` (offline topic identifier), `OpenAI` (to talk to LLMs), `json` (to format strings back to arrays), and `os` (to access the terminal environment variables).
* **Line 6:** Instantiates the heavy `KeyBERT()` algorithm directly into RAM.

```python
def get_llm_client():
    return OpenAI(
        base_url=os.getenv("OLLAMA_BASE_URL"),
        api_key=os.getenv("OLLAMA_API_KEY")
    )
```
* **Line 8-12:** Factory function retrieving an OpenAI standardized agent format. It swaps out standard OpenAI targeting for local `OLLAMA_BASE_URL` variables, effectively hijacking it to query our localized LLMs instead, for free.

```python
def extract_topics(chunks: list) -> dict:
    client = get_llm_client()
    
    all_text = ' '.join(c['text'] for c in chunks)
    sample_text = all_text[:15000] 
```
* **Line 14:** Begins the topic extractor utilizing a list payload wrapper.
* **Line 15:** Connects the LLM client engine.
* **Line 18:** Synthesizes the scattered strings backwards using a list comprehension (`c['text']`), gluing all parsed arrays together into one massive document variable `all_text`.
* **Line 19:** Force-chops the string, sending strictly the first 15,000 characters to process to prevent overwhelming the local memory bandwidth. 

```python
    print("      -> Running KeyBERT for foundational keywords...")
    keywords = kw_model.extract_keywords(
        sample_text, keyphrase_ngram_range=(1, 3), stop_words='english', top_n=50
    )
    kw_list = [kw for kw, score in keywords if score > 0.3]
```
* **Line 21-24:** Tells `kw_model` to extract mathematical anomalies (keywords) seeking phrases consisting of sets containing 1 to 3 concurrent words. It forces ignoring all common conjunctions (`stop_words='english'`), capping returns at a maximum of the strongest `50`.
* **Line 25:** List comprehension filtering. Drops any keyword that evaluated to an algorithmic relevance `score` below `0.3` (30%).

```python
    prompt = f"""
    You are an expert AI building an educational knowledge graph...
    """
    
    print("      -> Sending keywords to gpt-oss:120b-cloud...")
    response = client.chat.completions.create(
        model='gpt-oss:120b-cloud',
        messages=[{'role': 'user', 'content': prompt}],
        response_format={'type': 'json_object'},
        temperature=0.1
    )
    
    return json.loads(response.choices[0].message.content)
```
* **Line 28-44:** Assigns heavily rigid multi-line prompt instructions forcing the AI into an educator persona formatting JSON dependencies utilizing the previously scraped keyword variables.
* **Line 46-52:** Triggers the API request to the AI model dictating absolute JSON logic response constraint models. The `temperature=0.1` ensures the AI restricts its "creativity variance" effectively hardcoding it to respond practically uniformly every time.
* **Line 54:** Converts the string text retrieved out of the payload `response.choices` directly into a Python Dictionary map returning the unified result. 

### C. embedder.py (Memory Processing)
Generates semantic numeric vectors for topics so computers can understand conceptual similarity.

```python
from openai import OpenAI
import numpy as np
import os

def get_llm_client(): ... # (Same LLM Client initialization block handling Ollama credentials)

def embed_texts(texts: list[str], model='nomic-embed-text') -> list[list[float]]:
    client = get_llm_client()
    
    response = client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]
```
* **Line 1-7:** Normalizing script setup similar to previous files handling server instances. 
* **Line 8:** Sets up a request taking arrays of text strings and an optional parameter pointing by default to learning-specialized open weight AI models (`nomic-embed-text`). Dictates mapping back arrays consisting of arrays containing floating parameters.
* **Line 9:** Initiates client connection.
* **Line 12:** Bypasses chat AI engines jumping natively to `.embeddings.create()`. This translates topics mathematically. 
* **Line 13:** Iterates across the payload data array returning merely identical subsets of the numerical coordinate `embedding` elements generated.

### D. graph_builder.py (The Architect)
Creates structural nodes and interconnects lines mapping the entire ecosystem's knowledge domain. 

```python
import networkx as nx

def build_knowledge_graph(topics: list) -> nx.DiGraph:
    G = nx.DiGraph()
```
* **Line 1:** Imports mathematical algorithm ecosystem `networkx` mapping relationships logically.
* **Line 3-4:** Establishes the function and stamps an active `DiGraph` (Directed Graph) into variable `G` where vectors must flow from point A independently towards point B.

```python
    for topic in topics:
        G.add_node(
            topic['name'],
            display_name=topic.get('display_name'),
            description=topic.get('description'),
            difficulty=topic.get('difficulty', 1)
        )
```
* **Line 7-12:** Iterates directly against generated concepts injecting NetworkX Nodes. It declares `name` as an inflexible structural engine tag, inserting meta modifiers containing formatted variables checking if `.get()` attributes exist and substituting a fallback integer `1` as difficulty otherwise. 

```python
    for topic in topics:
        for prereq in topic.get('prerequisites', []):
            if prereq in G.nodes:
                G.add_edge(prereq, topic['name'], type='prerequisite')
                
    return G
```
* **Line 15-18:** Executes an underlying secondary iteration checking within the concepts list assessing the embedded prerequisite tags. If those specified tags legitimately exist mapped already (`in G.nodes`), an `add_edge` line segment binds the prerequisite starting item forward toward the current destination concept assigning an operational string status label measuring `type='prerequisite'`.
* **Line 20:** Finishes constructing the system handing back mapping parameters.

### E. pipeline.py (Core Runner Orchestration)
Invokes logic components in exact operational synchronization. 

```python
import os
from dotenv import load_dotenv

# MUST run before importing other modules so they get the API keys
load_dotenv() 

from parser import parse_pdf
from topic_extractor import extract_topics
from embedder import embed_texts
from graph_builder import build_knowledge_graph
```
* **Line 1-10:** Loads the environmental variables instantly leveraging `.env` parsing algorithms preventing key crashes on dependent imported libraries down the line ensuring all functional system imports inherit valid API keys natively before launching. 

```python
def run_engine_prototype(pdf_path: str):
    print(f"\n🚀 --- ACLS Context Engine Started ---")
    
    print("\n1. Data Acquisition & Chunking...")
    chunks = parse_pdf(pdf_path)
    # ... Print chunks length ...
    
    print("\n2. Entity & Relationship Extraction (Hybrid KeyBERT + Ollama)...")
    topic_data = extract_topics(chunks)
    topics_list = topic_data.get('topics', [])
    # ... Print extracted elements ...
    
    print("\n3. Generating Semantic Embeddings (nomic-embed-text)...")
    texts_to_embed = [t.get('description', '') for t in topics_list]
    if texts_to_embed:
        embeddings = embed_texts(texts_to_embed)
        # ... Print embeddings length ...
```
* **Line 12-28:** Main structural execution mapping operations. Line 16 invokes Parser. Line 21 processes Intelligence layer arrays isolating the dictionary array `['topics']`. Line 26 consolidates strings using list comprehension creating embeddable arrays passed dynamically to trigger Semantic logic (Line 28).

```python
    print("\n4. Building Knowledge Graph...")
    G = build_knowledge_graph(topics_list)
    # ...
    for node in G.nodes(data=True):
        topic_name = node[0]
        data = node[1]
        prereqs = list(G.predecessors(topic_name))
        leads_to = list(G.successors(topic_name))
        # ... Format Console Prints ...
```
* **Line 31-41:** Instructs the final node generation parsing results dynamically directly mapping nodes to query variable iterations capturing upstream graph targets (`.predecessors()`) discovering prerequisites, compared natively towards down-funnel requirements (`.successors()`) locking logic vectors for Console feedback visualization. 

```python
if __name__ == "__main__":
    sample_pdf = "sample.pdf" 
    
    if os.path.exists(sample_pdf):
        run_engine_prototype(sample_pdf)
    else:
        print(f"⚠️  ERROR...")
```
* **Line 47-53:** Global run parameter checking if internal OS module resolves valid files avoiding crash executions if missing prior to unleashing workflow logic blocks.

### F. student_model.py (The Analysis Tracker)
Establishes the engine retaining structural testing knowledge adjusting to adaptive signals dynamically. 

```python
class StudentModelingEngine:
    def __init__(self, data_file: str = "student_data.json"):
        self.students = {}
        self.data_file = data_file
        self.load_data() 
```
* **Line 6-12:** Defines Object classes configuring startup functions assigning target JSON retention files pulling existing user maps inside active execution `load_data()` dynamically.

```python
    def create_student(self, student_id: str, name: str):
        if student_id in self.students:
            return
        self.students[student_id] = {
            "student_id": student_id,
            "name": name,
            "created_at": self.current_time(),
            "topics": {},
            "attempt_history": []
        }
```
* **Line 15-24:** Generates primary internal user IDs avoiding overwriting duplications if dictionaries are active, filling templates configuring standard analytics fields alongside active histories. 

```python
    def add_topic(self, student_id: str, topic_name: str):
        student = self.get_student(student_id)
        if topic_name not in student["topics"]:
            student["topics"][topic_name] = {
                "total_attempts": 0,
                #... metrics ...,
                "status": "Not Started",
                "error_types": {},
                "last_revised": None
            }
```
* **Line 28-40:** Expands operational logic discovering distinct student classes querying dictionary configurations registering default statistics templates mapping out default metric arrays ensuring error tracking exists when required. 

```python
    def record_attempt(self, student_id: str, topic_name: str, question_id: str, 
                       is_correct: bool, error_type: Optional[str] = None, 
                       hints_used: int = 0, time_taken: int = 0):
        #... Validations ...
        topic = student["topics"][topic_name]
        topic["total_attempts"] += 1
        topic["hints_used"] += hints_used
        topic["total_time_taken"] += time_taken
        topic["last_revised"] = self.current_time()

        if is_correct:
            topic["correct_answers"] += 1
        else:
            topic["wrong_answers"] += 1
            error_type = error_type or "Unknown error"
            topic["error_types"][error_type] = topic["error_types"].get(error_type, 0) + 1
        
        #... push history list & triggering self.update_mastery() ...
```
* **Line 43-70:** Logs analytical actions. Compares targeted user profiles. Tallies base metrics modifying base integers alongside runtime. Processes binary logic statements checking `is_correct`. Modifies `wrong_answers` otherwise updating isolated dictionary subsets adding structural tags indexing unknown errors to specific variables dynamically recording lists and shifting into calculating subsequent algorithms updating Mastery logic blocks. 

```python
    def update_mastery(self, student_id: str, topic_name: str):
        topic = self.get_student(student_id)["topics"][topic_name]
        if topic["total_attempts"] == 0:
            mastery_score = 0
        else:
            mastery_score = (topic["correct_answers"] / topic["total_attempts"]) * 100
            mastery_score -= (topic["hints_used"] * 2)
            mastery_score = max(0, mastery_score)
        
        topic["mastery_score"] = round(mastery_score, 2)
        topic["status"] = self.classify_mastery(mastery_score)
```
* **Line 73-86:** Fetches logic extracting mathematical percentages measuring (correct relative to base quantities multiplied against 100 scaling ranges). Deducts explicit penalties processing `- 2%` modifiers directly upon usages scaling against 0 limiting negations. Concludes modifying internal variables parsing limits formatting thresholds calculating category mappings (`Weak`, `Medium`, etc.). 

```python
    def detect_misconceptions(self, student_id: str) -> Dict[str, List[str]]:
        student = self.get_student(student_id)
        misconceptions = {}
        for topic_name, topic_data in student["topics"].items():
            errors = [err for err, count in topic_data["error_types"].items() if count >= 3]
            if errors:
                misconceptions[topic_name] = errors
        return misconceptions
```
* **Line 97-104:** Navigates topics reviewing user fault subsets utilizing List Comprehensions stripping errors discovering explicit variations where aggregate totals hit integers `>= 3`. Flags configurations explicitly returning dict maps guiding systematic revisions formatting warning labels utilized inside Recommendation signals checking. 

### G. run_student_demo.py (The Simulation Visualizer)
Wraps Student Engine executing console demonstration operations formatting logs visualizing testing.

```python
import json
from student_model import StudentModelingEngine

def run_student_modeling_demo():
    engine = StudentModelingEngine(data_file="student_data.json")
    
    engine.create_student("S001", "Alex Johnson")
    
    engine.record_attempt("S001", "Limits", "Q1", is_correct=True, hints_used=0, time_taken=40)
    engine.record_attempt("S001", "Limits", "Q3", is_correct=False, error_type="Sign error", hints_used=2, time_taken=80)
    # ... more simulation code mimicking a quiz session...
    
    student = engine.get_student("S001")
    # ... outputs UI prints mapping array metrics parsing errors dict limits ...
    
    engine.save_data()
```
* **Line 1-52:** Imports custom scripts generating class definitions connecting files instantiating the simulation profile `S001` allocating fake assessment parameters feeding the intelligence logic recording attempt queries analyzing results and triggering `engine.save_data()` effectively terminating executing workflows rendering configuration updates persistently into `student_data.json`.

### H. student_data.json (Local Database)
This is an automated JSON database handling dictionary storage holding arrays consisting of string variables persisting user instances mapping attempt configurations explicitly retaining logic calculations generated downstream providing active checkpoints bypassing session configurations effectively establishing persistent memory mappings for the model.

--- 
This structure creates a full data processing chain—from unformatted raw PDFs all the way into intelligent cognitive models dynamically tracking topic performance via Node-edge maps ready-to-scale AI embeddings and mathematical graph networking constraints.
