# Bayesian Knowledge Tracing (BKT) Engine wrapper
# Connects with student_model to perform sequential mastery estimates.

try:
    from .student_model import StudentModelingEngine
except ImportError:
    from student_model import StudentModelingEngine

class BKTEngine:
    """
    Standard Bayesian Knowledge Tracing parameters model.
    Tracks state transitions: P(L0) initial, P(T) transition, P(G) slip, P(S) guess.
    """
    def __init__(self, p_init=0.15, p_trans=0.1, p_slip=0.1, p_guess=0.2):
        self.p_init = p_init
        self.p_trans = p_trans
        self.p_slip = p_slip
        self.p_guess = p_guess

    def get_updated_mastery(self, prior_mastery: float, is_correct: bool) -> float:
        # Simple BKT update rule
        p_known = prior_mastery / 100.0
        
        if is_correct:
            p_correct = p_known * (1 - self.p_slip) + (1 - p_known) * self.p_guess
            posterior = (p_known * (1 - self.p_slip)) / p_correct
        else:
            p_incorrect = p_known * self.p_slip + (1 - p_known) * (1 - self.p_guess)
            posterior = (p_known * self.p_slip) / p_incorrect
            
        updated_p = posterior + (1 - posterior) * self.p_trans
        return min(1.0, max(0.0, updated_p)) * 100.0
