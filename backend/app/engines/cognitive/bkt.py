# Bayesian Knowledge Tracing (BKT) Engine wrapper
# Connects with student_model to perform sequential mastery estimates.

try:
    # Try importing from the same package first (for relative imports in production)
    from .student_model import StudentModelingEngine
except ImportError:
    # Fallback to direct import (useful for running standalone demo scripts)
    from student_model import StudentModelingEngine

class BKTEngine:
    """
    Bayesian Knowledge Tracing (BKT) Engine.
    
    Tracks a student's learning state over a sequence of attempts on a topic.
    BKT updates the probability that a student knows a skill based on their
    correct or incorrect answers.
    
    Terminology:
    - P(L0): Initial probability that the student already knows the topic.
    - P(T): Probability that the student learns the topic after a practice attempt.
    - P(S): Slip probability (student knows the topic but makes a careless error).
    - P(G): Guess probability (student doesn't know the topic but guesses correctly).
    """

    def __init__(self, p_L0: float = 0.15, p_T: float = 0.1, p_S: float = 0.1, p_G: float = 0.2, student_model: StudentModelingEngine = None):
        """
        Initializes the BKT engine with parameters and an optional student model connection.
        All probabilities must be between 0 and 1.
        """
        # Validate probability values
        for name, value in [("p_L0", p_L0), ("p_T", p_T), ("p_S", p_S), ("p_G", p_G)]:
            if not isinstance(value, (int, float)):
                raise TypeError(f"BKT parameter {name} must be a number.")
            if not (0.0 <= value <= 1.0):
                raise ValueError(f"BKT parameter {name} must be between 0.0 and 1.0 (inclusive). Got: {value}")

        self.p_L0 = float(p_L0)
        self.p_T = float(p_T)
        self.p_S = float(p_S)
        self.p_G = float(p_G)
        self.student_model = student_model

    def update_mastery_after_attempt(self, prior_mastery: float, is_correct: bool) -> float:
        """
        Calculates the updated mastery score (as a percentage from 0 to 100) 
        after a student attempts a quiz question.
        
        Formula Steps:
        1. Convert prior mastery percentage (0-100) to a probability (0-1).
        2. Calculate the posterior probability of knowing the skill given the attempt.
        3. Account for transition (learning) probability.
        4. Convert the updated probability back to percentage form (0-100).
        """
        # Validate prior mastery input
        if not isinstance(prior_mastery, (int, float)):
            raise TypeError("prior_mastery must be a number.")
        if not (0.0 <= prior_mastery <= 100.0):
            raise ValueError(f"prior_mastery must be between 0.0 and 100.0. Got: {prior_mastery}")

        # Convert mastery percentage (0-100) to probability (0-1)
        p_known = prior_mastery / 100.0

        if is_correct:
            # P(Correct) = P(Known)*(1 - P(Slip)) + P(Unknown)*P(Guess)
            p_correct = p_known * (1.0 - self.p_S) + (1.0 - p_known) * self.p_G
            
            # Guard against division-by-zero. If P(Correct) is 0, posterior remains unchanged.
            if p_correct == 0.0:
                posterior = p_known
            else:
                # P(Known | Correct) = [P(Known) * (1 - P(Slip))] / P(Correct)
                posterior = (p_known * (1.0 - self.p_S)) / p_correct
        else:
            # P(Incorrect) = P(Known)*P(Slip) + P(Unknown)*(1 - P(Guess))
            p_incorrect = p_known * self.p_S + (1.0 - p_known) * (1.0 - self.p_G)
            
            # Guard against division-by-zero. If P(Incorrect) is 0, posterior remains unchanged.
            if p_incorrect == 0.0:
                posterior = p_known
            else:
                # P(Known | Incorrect) = [P(Known) * P(Slip)] / P(Incorrect)
                posterior = (p_known * self.p_S) / p_incorrect

        # Add learning transition step:
        # P(L_t) = Posterior + (1 - Posterior) * P(T)
        updated_p = posterior + (1.0 - posterior) * self.p_T

        # Clamp value to [0.0, 1.0] and convert back to percentage form
        updated_mastery_percentage = min(1.0, max(0.0, updated_p)) * 100.0
        return updated_mastery_percentage

    def classify_mastery(self, mastery_score: float) -> str:
        """
        Classifies the student's mastery score into a status.
        - 80 and above = Strong
        - 50 to 79 = Medium
        - Below 50 = Weak
        """
        if not isinstance(mastery_score, (int, float)):
            raise TypeError("mastery_score must be a number.")
            
        if mastery_score >= 80.0:
            return "Strong"
        elif mastery_score >= 50.0:
            return "Medium"
        else:
            return "Weak"

    def update_student_mastery(self, student_id: str, topic_name: str, is_correct: bool, student_model: StudentModelingEngine = None) -> float:
        """
        Connects the BKT engine with the StudentModelingEngine.
        - Reads the current mastery_score from the student model.
        - Calculates the new BKT mastery score.
        - Updates the topic's mastery_score and status (Strong/Medium/Weak).
        - Saves the updated student data.
        """
        # Resolve the student modeling engine instance
        active_model = student_model if student_model is not None else self.student_model
        if active_model is None:
            raise ValueError("StudentModelingEngine instance must be provided either in __init__ or in this method.")

        # Retrieve student profile from the model
        student = active_model.get_student(student_id)

        # Initialize the topic if it does not exist yet
        if topic_name not in student["topics"]:
            active_model.add_topic(student_id, topic_name)

        topic = student["topics"][topic_name]

        # Read current mastery score
        # If the student has zero attempts on this topic, we initialize the prior mastery 
        # to the BKT initial probability P(L0) in percentage form.
        if topic.get("total_attempts", 0) == 0:
            prior_mastery = self.p_L0 * 100.0
        else:
            prior_mastery = topic.get("mastery_score", 0.0)

        # Calculate new BKT mastery score
        new_mastery = self.update_mastery_after_attempt(prior_mastery, is_correct)
        
        # Round the mastery score to 2 decimal places to keep data neat
        new_mastery = round(new_mastery, 2)

        # Update the student model data
        topic["mastery_score"] = new_mastery
        topic["status"] = self.classify_mastery(new_mastery)

        # Save the student model changes to file
        active_model.save_data()

        return new_mastery

if __name__ == "__main__":
    print("==================================================")
    print("      🧠 BKT ENGINE STANDALONE DEMO & TEST")
    print("==================================================")
    
    # Initialize the engine
    bkt = BKTEngine(p_L0=0.15, p_T=0.1, p_S=0.1, p_G=0.2)
    print(f"Initialized BKT Engine with parameters:")
    print(f" - P(L0) [Initial knowledge]: {bkt.p_L0}")
    print(f" - P(T)  [Learning transition]: {bkt.p_T}")
    print(f" - P(S)  [Slip probability]: {bkt.p_S}")
    print(f" - P(G)  [Guess probability]: {bkt.p_G}\n")
    
    # Test 1: Single attempt updates
    print("--- Simulating sequential mastery updates for a topic ---")
    current_mastery = bkt.p_L0 * 100.0  # start with initial P(L0) as mastery percent
    print(f"Starting Mastery: {current_mastery:.2f}%")
    
    attempts = [True, True, False, True, True]
    for idx, is_correct in enumerate(attempts, 1):
        outcome = "CORRECT" if is_correct else "INCORRECT"
        next_mastery = bkt.update_mastery_after_attempt(current_mastery, is_correct)
        status = bkt.classify_mastery(next_mastery)
        print(f"Attempt #{idx} ({outcome}): {current_mastery:.2f}% -> {next_mastery:.2f}% | Status: {status}")
        current_mastery = next_mastery
        
    # Test 2: Validation checks
    print("\n--- Testing parameter validation ---")
    try:
        invalid_bkt = BKTEngine(p_L0=1.5)
    except ValueError as e:
        print(f"Successfully caught expected validation error: {e}")
        
    try:
        bkt.update_mastery_after_attempt(150.0, True)
    except ValueError as e:
        print(f"Successfully caught expected mastery validation error: {e}")

    # Test 3: Division-by-zero check
    print("\n--- Testing division-by-zero prevention ---")
    # Setting slip probability to 1.0 (always slips) and guess to 0.0 (never guesses)
    # can lead to division by zero if not handled.
    extreme_bkt = BKTEngine(p_L0=0.0, p_T=0.0, p_S=1.0, p_G=0.0)
    # Should run smoothly without raising ZeroDivisionError
    res = extreme_bkt.update_mastery_after_attempt(0.0, True)
    print(f"Extreme BKT result: {res:.2f}% (No division by zero!)")
    
    print("\nDemo finished successfully!")

"""
================================================================================
                    VIVA STUDY GUIDE & BKT ENGINE EXPLANATION
================================================================================

1. What this BKT Engine Does:
   - Bayesian Knowledge Tracing (BKT) is a standard cognitive modeling algorithm
     used to estimate a student's internal knowledge state based on their sequence 
     of answers (correct or incorrect).
   - It maintains a running probability that a student knows a specific skill, 
     updating this probability after each question attempt using Bayesian inference.

2. How it Connects with the Student Modeling Engine:
   - The StudentModelingEngine manages student profiles, logs quiz attempts, and 
     stores mastery scores in a database (JSON file).
   - The BKT Engine acts as the cognitive intelligence layer. Instead of using 
     static percentages for mastery, the StudentModelingEngine can call the BKT 
     Engine's `update_student_mastery` method. This method reads the student's 
     last mastery score, applies the BKT formula to the latest answer, updates 
     the student's record with the new BKT score and status (Weak/Medium/Strong), 
     and persists it.

3. Why BKT is Better than only using simple Accuracy (correct_answers / total_attempts):
   - Handles Guessing and Slipping: A student might get a question right by guessing 
     (P(G)) or get it wrong due to a careless mistake (P(S)). BKT accounts for these 
     probabilistic noise factors, unlike simple accuracy.
   - Learns and Tracks Progress Over Time: Simple accuracy weights old attempts 
     equally with new ones. If a student starts with 5 wrong answers and then gets 5 
     correct answers, their simple accuracy is only 50%. However, BKT understands 
     that the student has now learned the skill (P(T)), leading to a much higher 
     mastery score that reflects their current state.
   - Predictive Nature: BKT represents a cognitive model of human learning, allowing 
     adaptive engines to predict whether a student will get the next question right.

4. How Correct and Wrong Answers Affect the Mastery Score:
   - A Correct Answer: Increases the mastery score. The size of the increase depends 
     on the guess probability P(G). If guessing is high (e.g., multiple choice), 
     a correct answer increases mastery less. If guessing is low (e.g., free response), 
     a correct answer increases mastery more.
   - A Wrong Answer: Decreases the mastery score. The size of the decrease depends 
     on the slip probability P(S). If slipping is high (e.g., complex calculation 
     steps), a wrong answer decreases mastery less because the system assumes it 
     could be a minor mistake. If slipping is low, a wrong answer decreases mastery 
     significantly.
   - Transition step: After every update, BKT adds a "transition" probability P(T), 
     meaning the student has a chance of learning the topic after the attempt, 
     which pulls the mastery score slightly upward even after a wrong answer.
================================================================================
"""
