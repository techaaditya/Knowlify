# Prerequisite Guard Engine
# Checks whether all prerequisites for a specific concept are completed before unlocking.

def is_unlocked(topic_id: str, knowledge_graph, student_profile: dict) -> bool:
    """
    Checks if a topic is unlocked for a student based on prerequisite mastery.
    """
    if topic_id not in knowledge_graph.nodes:
        return True
        
    prereqs = list(knowledge_graph.predecessors(topic_id))
    for prereq in prereqs:
        student_topic = student_profile.get("topics", {}).get(prereq, {})
        mastery = student_topic.get("mastery_score", 0)
        # Prerequisite requires at least medium mastery (50%) to unlock downstream nodes
        if mastery < 50:
            return False
            
    return True
