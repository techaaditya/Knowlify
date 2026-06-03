# SM-2 Spaced Repetition Algorithm
# Calculates intervals, repetitions, and easiness factors.

def calculate_sm2(q: int, repetitions: int, previous_interval: int, previous_ease: float) -> tuple[int, int, float]:
    """
    SuperMemo-2 (SM-2) Algorithm.
    q: quality of response (0-5)
    repetitions: consecutive successful recall cycles
    previous_interval: previous interval in days
    previous_ease: previous easiness factor
    Returns: (new_interval_days, new_repetitions, new_ease_factor)
    """
    if q < 3:
        # Repetition failed; reset intervals
        return 1, 0, previous_ease
        
    # Calculate new ease factor
    ease = previous_ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ease = max(1.3, ease) # Ease factor floor is 1.3
    
    if repetitions == 0:
        interval = 1
    elif repetitions == 1:
        interval = 6
    else:
        interval = int(round(previous_interval * ease))
        
    return interval, repetitions + 1, ease
