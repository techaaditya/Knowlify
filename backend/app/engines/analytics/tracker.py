# Analytics Tracker Engine
# Aggregates student stats, completion times, and overall mastery trends.

def aggregate_dashboard_metrics(student_profile: dict) -> dict:
    """
    Computes global statistics for a student's analytics profile.
    """
    topics = student_profile.get("topics", {})
    if not topics:
        return {"average_mastery": 0, "completed_topics": 0}
        
    total_mastery = 0
    completed = 0
    for details in topics.values():
        total_mastery += details.get("mastery_score", 0)
        if details.get("mastery_score", 0) >= 80:
            completed += 1
            
    return {
        "average_mastery": round(total_mastery / len(topics), 2),
        "completed_topics": completed,
        "total_topics": len(topics)
    }
