# ==============================================================================
# DEMONSTRATION & TESTING SCRIPT FOR STUDENT MODELING ENGINE
#
# - This file is only for demonstration and testing purposes.
# - It simulates quiz attempts for a dummy student (Alex Johnson).
# - It helps showcase how Engine 2 (Cognitive & Student Modeling) works,
#   including mastery calculations, weak topic detection, and misconception diagnostics.
# ==============================================================================

import os
import sys

# Add the current directory to sys.path so imports work properly when running this script directly
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

try:
    # Try importing from the same package first
    from .student_model import StudentModelingEngine
except ImportError:
    # Fallback to direct import
    from student_model import StudentModelingEngine


def run_student_modeling_demo():
    print("==================================================")
    print("       KNOWLIFY: STUDENT MODELING ENGINE DEMO")
    print("==================================================")

    # 1. Reliable path handling for student_data.json
    data_file = os.path.join(_HERE, "student_data.json")

    # 2. Option to reset demo data before running
    # This prevents duplicate attempts from accumulating across repeated demo runs
    if os.path.exists(data_file):
        try:
            os.remove(data_file)
            print("[System] Cleared previous student database for a clean demo run.\n")
        except Exception as e:
            print(f"[System] Warning: Could not clear old database: {e}\n")

    # Initialize the engine
    engine = StudentModelingEngine(data_file=data_file)

    # 3. Setup a dummy student profile
    student_id = "S001"
    student_name = "Alex Johnson"
    print(f"-> Creating profile for student: {student_name} (ID: {student_id})")
    engine.create_student(student_id, student_name)

    # 4. Simulate attempts across three distinct topics

    # --- Topic A: Student performs well (e.g., 'Limits') ---
    print("\n-> Simulating attempts for 'Limits' (Strong Performance)...")
    engine.record_attempt(
        student_id=student_id,
        topic_name="Limits",
        question_id="L1",
        is_correct=True,
        hints_used=0,
        time_taken=30,
        confidence_level="High",
        difficulty="Easy"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Limits",
        question_id="L2",
        is_correct=True,
        hints_used=0,
        time_taken=45,
        confidence_level="High",
        difficulty="Medium"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Limits",
        question_id="L3",
        is_correct=True,
        hints_used=1,
        time_taken=60,
        confidence_level="Medium",
        difficulty="Hard"
    )

    # --- Topic B: Student struggles (e.g., 'Integration') ---
    print("-> Simulating attempts for 'Integration' (Struggling Performance)...")
    engine.record_attempt(
        student_id=student_id,
        topic_name="Integration",
        question_id="I1",
        is_correct=False,
        error_type="Integration constant missing",
        hints_used=2,
        time_taken=120,
        confidence_level="Low",
        difficulty="Medium"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Integration",
        question_id="I2",
        is_correct=False,
        error_type="Substitution error",
        hints_used=3,
        time_taken=140,
        confidence_level="Low",
        difficulty="Hard"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Integration",
        question_id="I3",
        is_correct=True,
        hints_used=1,
        time_taken=110,
        confidence_level="Medium",
        difficulty="Easy"
    )

    # --- Topic C: Student has repeated errors (e.g., 'Derivatives') ---
    print("-> Simulating attempts for 'Derivatives' (Repeated Errors / Misconceptions)...")
    engine.record_attempt(
        student_id=student_id,
        topic_name="Derivatives",
        question_id="D1",
        is_correct=False,
        error_type="Formula mistake",
        hints_used=1,
        time_taken=80,
        confidence_level="Low",
        difficulty="Medium"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Derivatives",
        question_id="D2",
        is_correct=False,
        error_type="Formula mistake",
        hints_used=2,
        time_taken=95,
        confidence_level="Low",
        difficulty="Medium"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Derivatives",
        question_id="D3",
        is_correct=False,
        error_type="Formula mistake",
        hints_used=2,
        time_taken=110,
        confidence_level="Low",
        difficulty="Hard"
    )
    engine.record_attempt(
        student_id=student_id,
        topic_name="Derivatives",
        question_id="D4",
        is_correct=True,
        hints_used=0,
        time_taken=50,
        confidence_level="Medium",
        difficulty="Easy"
    )

    # 5. Fetch student data for reporting
    student = engine.get_student(student_id)

    # 6. Print detailed diagnostic report
    print("\n==================================================")
    print("            STUDENT DIAGNOSTIC REPORT")
    print("==================================================")
    print(f"Student Name : {student['name']}")
    print(f"Student ID   : {student['student_id']}")
    print(f"Profile Created: {student['created_at']}")
    print("--------------------------------------------------")

    for topic_name, topic in student["topics"].items():
        print(f"\nTopic: {topic_name.upper()}")
        print(f"  - Total Attempts     : {topic['total_attempts']}")
        print(f"  - Correct Answers    : {topic['correct_answers']}")
        print(f"  - Wrong Answers      : {topic['wrong_answers']}")
        print(f"  - Mastery Score      : {topic['mastery_score']}%")
        print(f"  - Status             : {topic['status']}")
        print(f"  - Hints Used         : {topic['hints_used']}")
        print(f"  - Average Time Taken : {topic['average_time_taken']} seconds")
        print(f"  - Confidence Counts  : {topic['confidence_counts']}")
        print(f"  - Difficulty Attempts: {topic['difficulty_attempts']}")
        
        # Display error profile
        if topic["error_types"]:
            errors = ", ".join([f"'{err}': {count}x" for err, count in topic["error_types"].items()])
            print(f"  - Error Profile      : {errors}")
        else:
            print(f"  - Error Profile      : No errors recorded")
            
        # Display next review date
        review_date = topic.get("next_review_date", "N/A")
        print(f"  - Next Review Date   : {review_date}")

    # 7. Show Weak Topics
    print("\n--------------------------------------------------")
    weak_topics = engine.get_weak_topics(student_id)
    print(f"Weak Topics Detected: {weak_topics}")

    # 8. Show Misconception Detection
    misconceptions = engine.detect_misconceptions(student_id)
    print(f"Persistent Misconceptions: {misconceptions}")

    # 9. Show Recommendation Signals for each topic
    print("\n==================================================")
    print("         ADAPTIVE LEARNING RECOMMENDATIONS")
    print("==================================================")
    for topic_name in student["topics"].keys():
        signal = engine.get_recommendation_signal(student_id, topic_name)
        print(f"[{topic_name}]: {signal}")
    print("==================================================\n")

    # Save State
    engine.save_data()
    print("[System] Demo completed and state saved.")


if __name__ == "__main__":
    run_student_modeling_demo()
