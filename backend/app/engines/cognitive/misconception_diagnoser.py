# Misconception Diagnoser module
# Inspects patterns of wrong answers to identify systemic student errors.

try:
    # Try importing from the same package first (for relative imports in production)
    from .student_model import StudentModelingEngine
except ImportError:
    # Fallback to direct import (useful for running standalone demo scripts)
    from student_model import StudentModelingEngine

class MisconceptionDiagnoser:
    """
    Misconception Diagnoser Module.
    
    This engine analyzes the frequency and patterns of student errors.
    If a specific type of error occurs repeatedly (exceeding a threshold),
    it indicates a systemic misconception rather than a one-off careless mistake.
    """

    def __init__(self, threshold: int = 3):
        """
        Initializes the diagnoser with a positive integer error threshold.
        """
        # Validate that threshold is a positive integer
        if not isinstance(threshold, int) or threshold <= 0:
            raise ValueError("Threshold must be a positive integer.")
            
        self.threshold = threshold

    def diagnose(self, error_profile: dict) -> list[str]:
        """
        Analyzes an error profile dictionary (e.g. {"Formula mistake": 3, "Concept confusion": 1})
        and returns a list of error types that meet or exceed the threshold.
        """
        if not isinstance(error_profile, dict):
            raise TypeError("error_profile must be a dictionary.")

        misconceptions = []
        for error_type, count in error_profile.items():
            if count >= self.threshold:
                misconceptions.append(error_type)
        return misconceptions

    def get_error_severity(self, count: int) -> str:
        """
        Determines the severity of an error based on how many times it occurred.
        - Count equal to threshold: Medium severity
        - Count greater than threshold: High severity
        - Count less than threshold: No misconception
        """
        if count == self.threshold:
            return "Medium"
        elif count > self.threshold:
            return "High"
        return "None"

    def diagnose_topic(self, student_model: StudentModelingEngine, student_id: str, topic_name: str) -> list[str]:
        """
        Reads the error profile of a specific topic from the StudentModelingEngine
        and returns the list of detected misconceptions.
        """
        if student_model is None:
            raise ValueError("student_model instance must be provided.")

        student = student_model.get_student(student_id)
        if topic_name not in student["topics"]:
            return []

        topic_data = student["topics"][topic_name]
        error_profile = topic_data.get("error_types", {})
        
        return self.diagnose(error_profile)

    def diagnose_student(self, student_model: StudentModelingEngine, student_id: str) -> dict[str, list[str]]:
        """
        Scans all topics for a student and returns a dictionary mapping
        each topic to its list of detected misconceptions.
        """
        if student_model is None:
            raise ValueError("student_model instance must be provided.")

        student = student_model.get_student(student_id)
        student_misconceptions = {}

        for topic_name, topic_data in student["topics"].items():
            error_profile = topic_data.get("error_types", {})
            misconceptions = self.diagnose(error_profile)
            if misconceptions:
                student_misconceptions[topic_name] = misconceptions

        return student_misconceptions

    def generate_misconception_report(self, student_model: StudentModelingEngine, student_id: str) -> str:
        """
        Generates a human-readable text report of the student's misconceptions
        across all topics, complete with severity levels and recommendation hints.
        """
        if student_model is None:
            raise ValueError("student_model instance must be provided.")

        student = student_model.get_student(student_id)
        
        report_lines = []
        report_lines.append("==================================================")
        report_lines.append(f"🧠 MISCONCEPTION DIAGNOSTIC REPORT")
        report_lines.append(f"Student: {student['name']} ({student_id})")
        report_lines.append("==================================================")

        has_misconceptions = False

        for topic_name, topic_data in student["topics"].items():
            error_profile = topic_data.get("error_types", {})
            detected = self.diagnose(error_profile)
            
            if detected:
                has_misconceptions = True
                report_lines.append(f"\nTopic: {topic_name}")
                for error_type in detected:
                    count = error_profile[error_type]
                    severity = self.get_error_severity(count)
                    report_lines.append(f"  - [{severity} Severity] '{error_type}': occurred {count} times")
            else:
                report_lines.append(f"\nTopic: {topic_name}")
                report_lines.append("  - No persistent misconceptions detected.")

        if not has_misconceptions:
            report_lines.append("\nOverall Status: Student has no persistent misconceptions.")
            
        report_lines.append("==================================================")
        return "\n".join(report_lines)

if __name__ == "__main__":
    print("==================================================")
    print("   🧠 MISCONCEPTION DIAGNOSER STANDALONE DEMO")
    print("==================================================")
    
    # 1. Instantiate the diagnoser with default threshold = 3
    diagnoser = MisconceptionDiagnoser(threshold=3)
    print(f"Diagnoser initialized with threshold = {diagnoser.threshold}\n")
    
    # 2. Test manual profile diagnosis
    print("--- Test 1: Diagnose a raw error profile dict ---")
    sample_errors = {
        "Formula mistake": 4,      # Expected: High Severity (4 > 3)
        "Sign error": 3,            # Expected: Medium Severity (3 == 3)
        "Calculation lapse": 1     # Expected: Ignored (1 < 3)
    }
    print(f"Sample error profile: {sample_errors}")
    detected = diagnoser.diagnose(sample_errors)
    print(f"Detected misconceptions list: {detected}")
    for err in detected:
        count = sample_errors[err]
        print(f" - '{err}' (Count: {count}) -> Severity: {diagnoser.get_error_severity(count)}")

    # 3. Test threshold validation
    print("\n--- Test 2: Threshold validation check ---")
    try:
        invalid_diagnoser = MisconceptionDiagnoser(threshold=0)
    except ValueError as e:
        print(f"Successfully caught expected validation error: {e}")

    # 4. Integrate and test with a mockup Student Modeling Engine
    print("\n--- Test 3: Connecting with StudentModelingEngine ---")
    # Setup a temporary data file name
    temp_db = "temp_student_data.json"
    
    # Clean up any leftover temp files from prior runs
    import os
    if os.path.exists(temp_db):
        os.remove(temp_db)
        
    try:
        # Create student model engine instance
        engine = StudentModelingEngine(data_file=temp_db)
        
        # Setup student profile
        student_id = "S888"
        engine.create_student(student_id, "Jane Doe")
        
        # Add topics
        engine.add_topic(student_id, "Derivatives")
        engine.add_topic(student_id, "Limits")
        
        # Simulate errors for Derivatives (3 formula mistakes, 1 calculation mistake)
        print("Recording attempts for 'Derivatives'...")
        engine.record_attempt(student_id, "Derivatives", "Q1", is_correct=False, error_type="Formula mistake")
        engine.record_attempt(student_id, "Derivatives", "Q2", is_correct=False, error_type="Formula mistake")
        engine.record_attempt(student_id, "Derivatives", "Q3", is_correct=False, error_type="Calculation mistake")
        engine.record_attempt(student_id, "Derivatives", "Q4", is_correct=False, error_type="Formula mistake")
        
        # Simulate errors for Limits (2 sign errors - does not exceed threshold 3)
        print("Recording attempts for 'Limits'...")
        engine.record_attempt(student_id, "Limits", "Q5", is_correct=False, error_type="Sign error")
        engine.record_attempt(student_id, "Limits", "Q6", is_correct=False, error_type="Sign error")
        
        # Perform diagnoses
        print("\nDiagnosing topic 'Derivatives':")
        derivs_mis = diagnoser.diagnose_topic(engine, student_id, "Derivatives")
        print(f" -> Misconceptions in Derivatives: {derivs_mis}")
        
        print("\nDiagnosing all student topics:")
        student_mis = diagnoser.diagnose_student(engine, student_id)
        print(f" -> Full student misconceptions dictionary: {student_mis}")
        
        # Print report
        print("\nPrinting full misconception report:")
        report = diagnoser.generate_misconception_report(engine, student_id)
        print(report)
        
    finally:
        # Clean up temporary database file
        if os.path.exists(temp_db):
            os.remove(temp_db)
            
    print("\nDemo completed successfully!")

"""
================================================================================
                VIVA STUDY GUIDE & MISCONCEPTION DIAGNOSER EXPLANATION
================================================================================

1. What this Misconception Diagnoser Does:
   - It acts as an diagnostic auditor for a student's practice errors.
   - It scans the frequency of specific types of errors logged during practice.
   - If an error type occurs at or above the predefined threshold (default = 3),
     it flags it as a persistent, systemic misconception rather than an isolated, 
     careless mistake.

2. How it Connects with the Student Modeling Engine:
   - The StudentModelingEngine logs every quiz attempt and logs wrong answers under
     the 'error_types' dictionary inside each topic's data record.
   - The MisconceptionDiagnoser queries these 'error_types' dictionaries in the
     student profile database and applies its threshold filtering to diagnose which
     errors are persistent.

3. Why Repeated Mistakes are Treated as Misconceptions:
   - One-off mistakes happen due to slips, fatigue, or momentary confusion.
   - However, when the exact same kind of mistake (e.g., 'Sign error' or 'Formula mistake')
     reoccurs multiple times, it reveals a systematic flaw in the student's cognitive
     framework. The student has built a false mental rule that they are applying consistently.

4. How this Helps the Adaptive Learning Engine:
   - Precise Interventions: Instead of just telling the student "you are weak in Derivatives"
     and giving more of the same questions, the system can say "you specifically keep 
     making Formula mistakes."
   - Target Remediation: The Adaptive Learning Engine can recommend a specific micro-lesson 
     or targeted revision materials addressing that exact misconception (e.g., a video on the
     Power Rule formula) before allowing the student to resume practice.
================================================================================
"""
