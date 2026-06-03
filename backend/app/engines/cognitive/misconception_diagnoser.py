# Misconception Diagnoser module
# Inspects patterns of wrong answers to identify systemic student errors.

try:
    from .student_model import StudentModelingEngine
except ImportError:
    from student_model import StudentModelingEngine

class MisconceptionDiagnoser:
    def __init__(self, threshold: int = 3):
        self.threshold = threshold

    def diagnose(self, error_profile: dict) -> list[str]:
        """
        Analyzes the student's error types and isolates persistent errors.
        """
        misconceptions = []
        for error_type, count in error_profile.items():
            if count >= self.threshold:
                misconceptions.append(error_type)
        return misconceptions
