import json
import os
from datetime import datetime
from typing import Dict, List, Optional

class StudentModelingEngine:
    """
    Student Modeling Engine for Knowlify / ACLS.
    Responsible for tracking attempts, calculating mastery, and detecting misconceptions.
    """

    def __init__(self, data_file: str = "student_data.json"):
        self.students = {}
        self.data_file = data_file
        self.load_data() # Auto-load previous data if it exists

    # 1. Create a new student profile
    def create_student(self, student_id: str, name: str):
        if student_id in self.students:
            print(f"Student {student_id} already exists.")
            return

        self.students[student_id] = {
            "student_id": student_id,
            "name": name,
            "created_at": self.current_time(),
            "topics": {},
            "attempt_history": []
        }
        print(f"✅ Student profile created for {name}.")

    # 2. Add a topic to the student profile
    def add_topic(self, student_id: str, topic_name: str):
        student = self.get_student(student_id)

        if topic_name not in student["topics"]:
            student["topics"][topic_name] = {
                "total_attempts": 0,
                "correct_answers": 0,
                "wrong_answers": 0,
                "hints_used": 0,
                "total_time_taken": 0,
                "mastery_score": 0,
                "status": "Not Started",
                "error_types": {},
                "last_revised": None
            }
            print(f"📚 Topic '{topic_name}' added for {student['name']}.")

    # 3. Record a quiz or practice attempt
    def record_attempt(self, student_id: str, topic_name: str, question_id: str, 
                       is_correct: bool, error_type: Optional[str] = None, 
                       hints_used: int = 0, time_taken: int = 0):
        student = self.get_student(student_id)

        if topic_name not in student["topics"]:
            self.add_topic(student_id, topic_name)

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

        attempt = {
            "question_id": question_id,
            "topic": topic_name,
            "is_correct": is_correct,
            "error_type": error_type,
            "hints_used": hints_used,
            "time_taken_seconds": time_taken,
            "attempted_at": self.current_time()
        }
        student["attempt_history"].append(attempt)
        self.update_mastery(student_id, topic_name)

    # 4. Calculate mastery score
    def update_mastery(self, student_id: str, topic_name: str):
        topic = self.get_student(student_id)["topics"][topic_name]
        
        if topic["total_attempts"] == 0:
            mastery_score = 0
        else:
            # Baseline accuracy
            mastery_score = (topic["correct_answers"] / topic["total_attempts"]) * 100
            # Hint penalty (2% per hint)
            mastery_score -= (topic["hints_used"] * 2)
            mastery_score = max(0, mastery_score) # Don't drop below 0

        topic["mastery_score"] = round(mastery_score, 2)
        topic["status"] = self.classify_mastery(mastery_score)

    # 5. Classify topic
    def classify_mastery(self, mastery_score: float) -> str:
        if mastery_score >= 80: return "Strong"
        elif mastery_score >= 50: return "Medium"
        else: return "Weak"

    # 6. Get weak topics
    def get_weak_topics(self, student_id: str) -> List[str]:
        student = self.get_student(student_id)
        return [name for name, data in student["topics"].items() if data["status"] == "Weak"]

    # 7. Detect repeated misconceptions
    def detect_misconceptions(self, student_id: str) -> Dict[str, List[str]]:
        student = self.get_student(student_id)
        misconceptions = {}
        for topic_name, topic_data in student["topics"].items():
            # If error happens 3 or more times, it's a persistent misconception
            errors = [err for err, count in topic_data["error_types"].items() if count >= 3]
            if errors:
                misconceptions[topic_name] = errors
        return misconceptions

    # 8. Get recommendation signal
    def get_recommendation_signal(self, student_id: str, topic_name: str) -> str:
        student = self.get_student(student_id)
        if topic_name not in student["topics"]:
            return "No data available. Start this topic first."

        status = student["topics"][topic_name]["status"]
        misconceptions = self.detect_misconceptions(student_id).get(topic_name, [])

        if status == "Weak":
            if misconceptions:
                return f"⚠️ URGENT REVISION: Persistent misconceptions detected -> {misconceptions}"
            return "Needs foundational review and practice."
        elif status == "Medium":
            return "Needs advanced practice questions to reach mastery."
        return "Ready to progress to the next topic."

    # 9. JSON Data Management
    def save_data(self):
        with open(self.data_file, "w") as file:
            json.dump(self.students, file, indent=4)
        print(f"💾 Student data saved to {self.data_file}.")

    def load_data(self):
        if os.path.exists(self.data_file):
            with open(self.data_file, "r") as file:
                self.students = json.load(file)

    def get_student(self, student_id: str):
        if student_id not in self.students:
            raise ValueError(f"Student {student_id} not found.")
        return self.students[student_id]

    def current_time(self):
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")