import http.server
import socketserver
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

# Import backend engines
from student_model import StudentModelingEngine
from pipeline import run_engine_prototype

PORT = 8000
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# Pre-defined Calculus Knowledge Graph
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

CACHE_FILE = "extracted_graph_cache.json"

class DashboardAPIHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for convenience
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/api/student":
            self.handle_get_student()
        elif path == "/api/graph":
            query = parse_qs(parsed_url.query)
            course = query.get("course", ["Calculus"])[0]
            self.handle_get_graph(course)
        else:
            # Serve static files normally
            super().do_GET()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/api/attempt":
            self.handle_post_attempt()
        elif path == "/api/extract":
            self.handle_post_extract()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_get_student(self):
        try:
            engine = StudentModelingEngine(data_file="student_data.json")
            # If no students, initialize the default one
            if not engine.students:
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

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(engine.students).encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error reading student data: {str(e)}")

    def handle_get_graph(self, course):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()

        if course == "Calculus":
            self.wfile.write(json.dumps(CALCULUS_GRAPH).encode('utf-8'))
            return

        # Voice Banking Paper - Load from cache or run pipeline
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, "r") as f:
                graph_data = json.load(f)
            self.wfile.write(json.dumps(graph_data).encode('utf-8'))
        else:
            # Generate graph data by running a fast mock parser as a fallback,
            # or runs real pipeline if sample.pdf is present
            graph_data = self.generate_pdf_graph("sample.pdf")
            self.wfile.write(json.dumps(graph_data).encode('utf-8'))

    def handle_post_attempt(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))

        student_id = data.get("student_id", "S001")
        topic_name = data.get("topic_name")
        question_id = data.get("question_id", "Q_MOCK")
        is_correct = data.get("is_correct", True)
        error_type = data.get("error_type", None)
        hints_used = int(data.get("hints_used", 0))
        time_taken = int(data.get("time_taken", 60))

        try:
            engine = StudentModelingEngine(data_file="student_data.json")
            if student_id not in engine.students:
                engine.create_student(student_id, "Alex Johnson")

            engine.record_attempt(
                student_id, topic_name, question_id, 
                is_correct, error_type, hints_used, time_taken
            )
            engine.save_data()

            # Include recommendations in the response
            student = engine.get_student(student_id)
            recommendation = engine.get_recommendation_signal(student_id, topic_name)
            weak_topics = engine.get_weak_topics(student_id)
            misconceptions = engine.detect_misconceptions(student_id)

            response_data = {
                "success": True,
                "student": student,
                "recommendation": recommendation,
                "weak_topics": weak_topics,
                "misconceptions": misconceptions
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Error recording attempt: {str(e)}")

    def handle_post_extract(self):
        try:
            # Trigger pipeline on sample.pdf
            print("\n⚙️ API Triggered Knowledge Graph Construction for sample.pdf...")
            graph_data = self.generate_pdf_graph("sample.pdf")
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(graph_data).encode('utf-8'))
        except Exception as e:
            self.send_error(500, f"Extraction failed: {str(e)}")

    def generate_pdf_graph(self, pdf_path):
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
            raise e

def run():
    # If starting, check if student_data.json exists. If not, generate sample
    engine = StudentModelingEngine(data_file="student_data.json")
    if not engine.students:
        engine.create_student("S001", "Alex Johnson")
        engine.record_attempt("S001", "Limits", "Q1", is_correct=True, hints_used=0, time_taken=40)
        engine.record_attempt("S001", "Limits", "Q2", is_correct=True, hints_used=1, time_taken=55)
        engine.record_attempt("S001", "Limits", "Q3", is_correct=False, error_type="Sign error", hints_used=2, time_taken=80)
        engine.record_attempt("S001", "Derivatives", "Q4", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=90)
        engine.record_attempt("S001", "Derivatives", "Q5", is_correct=False, error_type="Formula mistake", hints_used=1, time_taken=85)
        engine.record_attempt("S001", "Derivatives", "Q6", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=95)
        engine.record_attempt("S001", "Derivatives", "Q7", is_correct=True, hints_used=1, time_taken=70)
        engine.save_data()

    print(f"🌍 Starting local server on http://localhost:{PORT}")
    server_address = ('', PORT)
    httpd = socketserver.TCPServer(server_address, DashboardAPIHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    run()
