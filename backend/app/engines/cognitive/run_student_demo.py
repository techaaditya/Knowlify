import json
import sys
import os

# Allow running directly from this directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from .student_model import StudentModelingEngine
except ImportError:
    from student_model import StudentModelingEngine

def run_student_modeling_demo():
    print("==================================================")
    print("   🧠 KNOWLIFY: STUDENT MODELING ENGINE (DEMO)")
    print("==================================================\n")

    # Initialize the engine — data file relative to project root
    data_file = os.path.join(os.path.dirname(__file__), "../../../../", "student_data.json")
    engine = StudentModelingEngine(data_file=data_file)

    # 1. Setup Dummy Student
    print("▶ INITIALIZING STUDENT...")
    student_id = "S001"
    engine.create_student(student_id, "Alex Johnson")
    
    # 2. Simulate Quiz on 'Limits' (Mostly Correct)
    print("\n▶ SIMULATING QUIZ 1: 'Limits'")
    engine.record_attempt(student_id, "Limits", "Q1", is_correct=True, hints_used=0, time_taken=40)
    engine.record_attempt(student_id, "Limits", "Q2", is_correct=True, hints_used=1, time_taken=55)
    engine.record_attempt(student_id, "Limits", "Q3", is_correct=False, error_type="Sign error", hints_used=2, time_taken=80)

    # 3. Simulate Quiz on 'Derivatives' (Struggling - Repeated Error)
    print("▶ SIMULATING QUIZ 2: 'Derivatives'")
    engine.record_attempt(student_id, "Derivatives", "Q4", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=90)
    engine.record_attempt(student_id, "Derivatives", "Q5", is_correct=False, error_type="Formula mistake", hints_used=1, time_taken=85)
    engine.record_attempt(student_id, "Derivatives", "Q6", is_correct=False, error_type="Formula mistake", hints_used=2, time_taken=95)
    engine.record_attempt(student_id, "Derivatives", "Q7", is_correct=True, hints_used=1, time_taken=70)

    # 4. Fetch Results
    student = engine.get_student(student_id)
    
    print("\n==================================================")
    print("   📊 STUDENT DIAGNOSTIC REPORT")
    print("==================================================")
    print(f"Student: {student['name']} ({student['student_id']})")
    
    for topic_name, topic in student["topics"].items():
        print(f"\n🔹 Topic: {topic_name.upper()}")
        print(f"   Accuracy:      {topic['correct_answers']}/{topic['total_attempts']}")
        print(f"   Hints Used:    {topic['hints_used']}")
        print(f"   Mastery Score: {topic['mastery_score']}%  => [ {topic['status'].upper()} ]")
        
        if topic["error_types"]:
            print("   Error Profile:")
            for err, count in topic["error_types"].items():
                print(f"     - {err}: {count} times")

    # 5. Show Adaptive Engine Signals
    print("\n==================================================")
    print("   🚨 ADAPTIVE ENGINE SIGNALS (ENGINE 3 PREP)")
    print("==================================================")
    print(f"Weak Topics Detected: {engine.get_weak_topics(student_id)}")
    
    signal_limits = engine.get_recommendation_signal(student_id, "Limits")
    signal_derivs = engine.get_recommendation_signal(student_id, "Derivatives")
    
    print(f"\nAction for Limits:      {signal_limits}")
    print(f"Action for Derivatives: {signal_derivs}")

    # 6. Save State
    print("\n")
    engine.save_data()

if __name__ == "__main__":
    run_student_modeling_demo()
