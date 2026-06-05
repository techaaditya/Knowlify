import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class StudentModelingEngine:
    """
    Student Modeling Engine for Knowlify / ACLS.

    This improved version tracks:
    - Student profiles
    - Topic-wise quiz attempts
    - Correct and wrong answers
    - Hint usage
    - Time taken
    - Confidence level
    - Question difficulty
    - Mastery score
    - Weak/Medium/Strong status
    - Repeated misconceptions
    - Revision schedule
    - Prerequisite weakness/root-cause check
    - JSON save/load
    """

    def __init__(self, data_file: str = "student_data.json", prerequisites: Optional[Dict[str, List[str]]] = None):
        self.students = {}
        self.data_file = data_file

        # Prerequisite map helps find the root cause of weakness.
        # Example: Derivatives depends on Limits.
        self.prerequisites = prerequisites or {
            "Derivatives": ["Limits"],
            "Integration": ["Derivatives"],
            "SQL Joins": ["Primary Key", "Foreign Key"],
            "Normalization": ["Functional Dependencies"]
        }

        self.load_data()

    # ----------------------------------------------------
    # 1. Create a new student profile
    # ----------------------------------------------------
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

        self.save_data()
        print(f"Student profile created for {name}.")

    # ----------------------------------------------------
    # 2. Add a topic to the student profile
    # ----------------------------------------------------
    def add_topic(self, student_id: str, topic_name: str):
        student = self.get_student(student_id)

        if topic_name not in student["topics"]:
            student["topics"][topic_name] = self.default_topic_data()
            self.save_data()
            print(f"Topic '{topic_name}' added for {student['name']}.")

    # ----------------------------------------------------
    # Default topic structure
    # ----------------------------------------------------
    def default_topic_data(self):
        return {
            "total_attempts": 0,
            "correct_answers": 0,
            "wrong_answers": 0,

            "hints_used": 0,
            "total_time_taken": 0,
            "average_time_taken": 0,

            "mastery_score": 0,
            "status": "Not Started",

            "error_types": {},
            "last_revised": None,
            "next_review_date": None,

            # New additions
            "confidence_counts": {
                "Low": 0,
                "Medium": 0,
                "High": 0
            },
            "difficulty_attempts": {
                "Easy": 0,
                "Medium": 0,
                "Hard": 0
            },

            # Used to calculate difficulty-weighted mastery
            "weighted_correct_points": 0,
            "weighted_total_points": 0
        }

    # ----------------------------------------------------
    # Make old saved JSON compatible with new fields
    # ----------------------------------------------------
    def ensure_topic_defaults(self, topic: dict):
        defaults = self.default_topic_data()

        for key, value in defaults.items():
            if key not in topic:
                topic[key] = value

        for key, value in defaults["confidence_counts"].items():
            if key not in topic["confidence_counts"]:
                topic["confidence_counts"][key] = value

        for key, value in defaults["difficulty_attempts"].items():
            if key not in topic["difficulty_attempts"]:
                topic["difficulty_attempts"][key] = value

        return topic

    # ----------------------------------------------------
    # 3. Record a quiz or practice attempt
    # ----------------------------------------------------
    def record_attempt(
        self,
        student_id: str,
        topic_name: str,
        question_id: str,
        is_correct: bool,
        error_type: Optional[str] = None,
        hints_used: int = 0,
        time_taken: int = 0,
        confidence_level: str = "Medium",
        difficulty: str = "Medium"
    ):
        """
        This function is called whenever a student answers a question.

        New fields added:
        - confidence_level: Low, Medium, or High
        - difficulty: Easy, Medium, or Hard
        """

        student = self.get_student(student_id)

        if topic_name not in student["topics"]:
            self.add_topic(student_id, topic_name)

        topic = self.ensure_topic_defaults(student["topics"][topic_name])

        confidence_level = self.normalize_confidence(confidence_level)
        difficulty = self.normalize_difficulty(difficulty)

        # Update basic attempt data
        topic["total_attempts"] += 1
        topic["hints_used"] += max(0, hints_used)
        topic["total_time_taken"] += max(0, time_taken)
        topic["average_time_taken"] = round(topic["total_time_taken"] / topic["total_attempts"], 2)
        topic["last_revised"] = self.current_time()

        # Track confidence and difficulty
        topic["confidence_counts"][confidence_level] += 1
        topic["difficulty_attempts"][difficulty] += 1

        # Weighted scoring means hard questions matter more than easy questions.
        difficulty_weight = self.get_difficulty_weight(difficulty)
        topic["weighted_total_points"] += difficulty_weight

        if is_correct:
            topic["correct_answers"] += 1
            topic["weighted_correct_points"] += difficulty_weight
        else:
            topic["wrong_answers"] += 1
            error_type = error_type or "Unknown error"
            topic["error_types"][error_type] = topic["error_types"].get(error_type, 0) + 1

        # Store full attempt history
        attempt = {
            "question_id": question_id,
            "topic": topic_name,
            "is_correct": is_correct,
            "error_type": error_type,
            "hints_used": hints_used,
            "time_taken_seconds": time_taken,
            "confidence_level": confidence_level,
            "difficulty": difficulty,
            "attempted_at": self.current_time()
        }

        student["attempt_history"].append(attempt)

        # Update mastery and revision date after every attempt
        self.update_mastery(student_id, topic_name)
        self.update_revision_schedule(student_id, topic_name)

        # Auto-save so progress is not lost
        self.save_data()

    # ----------------------------------------------------
    # 4. Calculate mastery score
    # ----------------------------------------------------
    def update_mastery(self, student_id: str, topic_name: str):
        topic = self.get_student(student_id)["topics"][topic_name]
        topic = self.ensure_topic_defaults(topic)

        total_attempts = topic["total_attempts"]

        if total_attempts == 0:
            mastery_score = 0
        else:
            # Difficulty-weighted accuracy.
            # If weighted values exist, use them. Otherwise use normal accuracy.
            if topic["weighted_total_points"] > 0:
                accuracy = (topic["weighted_correct_points"] / topic["weighted_total_points"]) * 100
            else:
                accuracy = (topic["correct_answers"] / total_attempts) * 100

            # Hint penalty is based on average hint use, not total hints.
            # This is fairer when students practice many questions.
            average_hints = topic["hints_used"] / total_attempts
            hint_penalty = average_hints * 5

            # Low confidence penalty.
            # If many answers are low confidence, mastery should be slightly lower.
            low_confidence_ratio = topic["confidence_counts"]["Low"] / total_attempts
            confidence_penalty = low_confidence_ratio * 5

            # Time penalty.
            # If average time is very high, student may need fluency practice.
            average_time = topic["average_time_taken"]
            if average_time > 120:
                time_penalty = 5
            elif average_time > 90:
                time_penalty = 3
            else:
                time_penalty = 0

            mastery_score = accuracy - hint_penalty - confidence_penalty - time_penalty
            mastery_score = max(0, min(100, mastery_score))

        topic["mastery_score"] = round(mastery_score, 2)
        topic["status"] = self.classify_mastery(mastery_score)

    # ----------------------------------------------------
    # 5. Classify topic
    # ----------------------------------------------------
    def classify_mastery(self, mastery_score: float) -> str:
        if mastery_score >= 80:
            return "Strong"
        elif mastery_score >= 50:
            return "Medium"
        else:
            return "Weak"

    # ----------------------------------------------------
    # 6. Update revision schedule
    # ----------------------------------------------------
    def update_revision_schedule(self, student_id: str, topic_name: str):
        topic = self.get_student(student_id)["topics"][topic_name]
        status = topic["status"]

        if status == "Weak":
            review_after_days = 1
        elif status == "Medium":
            review_after_days = 3
        else:
            review_after_days = 7

        next_review = datetime.now() + timedelta(days=review_after_days)
        topic["next_review_date"] = next_review.strftime("%Y-%m-%d")

    # ----------------------------------------------------
    # 7. Get weak topics
    # ----------------------------------------------------
    def get_weak_topics(self, student_id: str) -> List[str]:
        student = self.get_student(student_id)
        weak_topics = []

        for topic_name, topic_data in student["topics"].items():
            topic_data = self.ensure_topic_defaults(topic_data)
            if topic_data["status"] == "Weak":
                weak_topics.append(topic_name)

        return weak_topics

    # ----------------------------------------------------
    # 8. Detect repeated misconceptions
    # ----------------------------------------------------
    def detect_misconceptions(self, student_id: str) -> Dict[str, List[str]]:
        """
        If the same error type occurs 3 or more times,
        the engine marks it as a persistent misconception.
        """

        student = self.get_student(student_id)
        misconceptions = {}

        for topic_name, topic_data in student["topics"].items():
            topic_data = self.ensure_topic_defaults(topic_data)

            errors = [
                error_type
                for error_type, count in topic_data["error_types"].items()
                if count >= 3
            ]

            if errors:
                misconceptions[topic_name] = errors

        return misconceptions

    # ----------------------------------------------------
    # 9. Check prerequisite weakness / root cause
    # ----------------------------------------------------
    def check_prerequisite_weakness(self, student_id: str, topic_name: str) -> List[str]:
        """
        Example:
        If Derivatives is weak, check whether Limits is also weak.
        """

        student = self.get_student(student_id)
        weak_prerequisites = []

        required_topics = self.prerequisites.get(topic_name, [])

        for prerequisite in required_topics:
            if prerequisite in student["topics"]:
                prerequisite_data = self.ensure_topic_defaults(student["topics"][prerequisite])
                if prerequisite_data["status"] == "Weak":
                    weak_prerequisites.append(prerequisite)

        return weak_prerequisites

    # ----------------------------------------------------
    # 10. Get recommendation signal
    # ----------------------------------------------------
    def get_recommendation_signal(self, student_id: str, topic_name: str) -> str:
        """
        This gives a useful signal to the Adaptive Learning Engine.
        It does not generate content directly.
        """

        student = self.get_student(student_id)

        if topic_name not in student["topics"]:
            return "No data available. Start this topic first."

        topic = self.ensure_topic_defaults(student["topics"][topic_name])
        status = topic["status"]
        misconceptions = self.detect_misconceptions(student_id).get(topic_name, [])
        weak_prerequisites = self.check_prerequisite_weakness(student_id, topic_name)

        if weak_prerequisites:
            return (
                f"Review prerequisite topic(s) first: {weak_prerequisites}. "
                f"The weakness in {topic_name} may be caused by weak foundation."
            )

        if status == "Weak":
            if misconceptions:
                return f"Urgent revision needed. Persistent misconception detected: {misconceptions}"
            return "Needs foundational review and more practice."

        if status == "Medium":
            return "Needs more practice questions to reach mastery."

        if status == "Strong":
            return "Ready to progress to the next topic."

        return "No recommendation available."

    # ----------------------------------------------------
    # 11. Get topics due for revision
    # ----------------------------------------------------
    def get_due_reviews(self, student_id: str) -> List[str]:
        student = self.get_student(student_id)
        due_topics = []
        today = datetime.now().date()

        for topic_name, topic_data in student["topics"].items():
            topic_data = self.ensure_topic_defaults(topic_data)
            next_review_date = topic_data.get("next_review_date")

            if next_review_date:
                review_date = datetime.strptime(next_review_date, "%Y-%m-%d").date()
                if review_date <= today:
                    due_topics.append(topic_name)

        return due_topics

    # ----------------------------------------------------
    # 12. Generate student summary
    # ----------------------------------------------------
    def generate_student_summary(self, student_id: str):
        student = self.get_student(student_id)

        print("\n========== STUDENT MODEL SUMMARY ==========")
        print(f"Student ID: {student['student_id']}")
        print(f"Name: {student['name']}")
        print(f"Created At: {student['created_at']}")
        print("-------------------------------------------")

        for topic_name, topic in student["topics"].items():
            topic = self.ensure_topic_defaults(topic)

            print(f"\nTopic: {topic_name}")
            print(f"Total Attempts: {topic['total_attempts']}")
            print(f"Correct Answers: {topic['correct_answers']}")
            print(f"Wrong Answers: {topic['wrong_answers']}")
            print(f"Hints Used: {topic['hints_used']}")
            print(f"Average Time Taken: {topic['average_time_taken']} seconds")
            print(f"Mastery Score: {topic['mastery_score']}%")
            print(f"Status: {topic['status']}")
            print(f"Last Revised: {topic['last_revised']}")
            print(f"Next Review Date: {topic['next_review_date']}")
            print(f"Confidence Counts: {topic['confidence_counts']}")
            print(f"Difficulty Attempts: {topic['difficulty_attempts']}")

            if topic["error_types"]:
                print("Error Types:")
                for error, count in topic["error_types"].items():
                    print(f"  - {error}: {count} times")

            weak_prerequisites = self.check_prerequisite_weakness(student_id, topic_name)
            if weak_prerequisites:
                print(f"Weak Prerequisites: {weak_prerequisites}")

        print("\nWeak Topics:", self.get_weak_topics(student_id))
        print("Detected Misconceptions:", self.detect_misconceptions(student_id))
        print("Topics Due for Review:", self.get_due_reviews(student_id))
        print("===========================================\n")

    # ----------------------------------------------------
    # 13. JSON data management
    # ----------------------------------------------------
    def save_data(self):
        dir_name = os.path.dirname(os.path.abspath(self.data_file))

        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

        with open(self.data_file, "w") as file:
            json.dump(self.students, file, indent=4)

    def load_data(self):
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, "r") as file:
                    self.students = json.load(file)
            except json.JSONDecodeError:
                print("Warning: Data file exists but is not valid JSON. Starting with empty data.")
                self.students = {}

    # ----------------------------------------------------
    # Helper functions
    # ----------------------------------------------------
    def get_student(self, student_id: str):
        if student_id not in self.students:
            raise ValueError(f"Student {student_id} not found.")
        return self.students[student_id]

    def current_time(self):
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def normalize_confidence(self, confidence_level: str) -> str:
        confidence_level = confidence_level.capitalize()

        if confidence_level not in ["Low", "Medium", "High"]:
            return "Medium"

        return confidence_level

    def normalize_difficulty(self, difficulty: str) -> str:
        difficulty = difficulty.capitalize()

        if difficulty not in ["Easy", "Medium", "Hard"]:
            return "Medium"

        return difficulty

    def get_difficulty_weight(self, difficulty: str) -> float:
        weights = {
            "Easy": 1.0,
            "Medium": 1.5,
            "Hard": 2.0
        }

        return weights.get(difficulty, 1.5)


# ----------------------------------------------------
# Example usage
# ----------------------------------------------------
if __name__ == "__main__":
    engine = StudentModelingEngine()

    # Create student
    engine.create_student("S001", "Student A")

    # Add topics
    engine.add_topic("S001", "Limits")
    engine.add_topic("S001", "Derivatives")

    # Attempts for Limits
    engine.record_attempt(
        student_id="S001",
        topic_name="Limits",
        question_id="Q1",
        is_correct=True,
        hints_used=0,
        time_taken=45,
        confidence_level="High",
        difficulty="Easy"
    )

    engine.record_attempt(
        student_id="S001",
        topic_name="Limits",
        question_id="Q2",
        is_correct=False,
        error_type="Concept confusion",
        hints_used=2,
        time_taken=110,
        confidence_level="Low",
        difficulty="Medium"
    )

    # Attempts for Derivatives
    engine.record_attempt(
        student_id="S001",
        topic_name="Derivatives",
        question_id="Q3",
        is_correct=False,
        error_type="Formula mistake",
        hints_used=2,
        time_taken=130,
        confidence_level="Low",
        difficulty="Medium"
    )

    # Attempts for Derivatives
    engine.record_attempt(
        student_id="S001",
        topic_name="Derivatives",
        question_id="Q4",
        is_correct=False,
        error_type="Formula mistake",
        hints_used=1,
        time_taken=100,
        confidence_level="Low",
        difficulty="Hard"
    )

    # Attempts for Derivatives
    engine.record_attempt(
        student_id="S001",
        topic_name="Derivatives",
        question_id="Q5",
        is_correct=False,
        error_type="Formula mistake",
        hints_used=2,
        time_taken=140,
        confidence_level="Low",
        difficulty="Hard"
    )

    # Attempts for Derivatives
    engine.record_attempt(
        student_id="S001",
        topic_name="Derivatives",
        question_id="Q6",
        is_correct=True,
        hints_used=1,
        time_taken=85,
        confidence_level="Medium",
        difficulty="Easy"
    )

    # Show summary
    engine.generate_student_summary("S001")

    # Show recommendation signal
    print("Recommendation Signal:")
    print(engine.get_recommendation_signal("S001", "Derivatives"))
