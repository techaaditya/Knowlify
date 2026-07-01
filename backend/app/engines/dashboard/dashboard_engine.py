from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Optional


def _safe_topic_name(attempt: dict) -> str:
    return attempt.get("topic") or attempt.get("topic_name") or "Unknown"


def _attempt_time(attempt: dict) -> int:
    return int(attempt.get("time_taken_seconds") or attempt.get("time_taken") or 0)


def _attempt_date(attempt: dict) -> str:
    value = attempt.get("attempted_at") or attempt.get("date") or ""
    if not value:
        return "Unknown"
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return str(value).split(" ")[0]


def summarize_student(student_profile: dict) -> dict:
    topics = student_profile.get("topics", {})
    attempts = student_profile.get("attempt_history", [])
    mastery_values = [topic.get("mastery_score", 0) for topic in topics.values()]
    total_attempts = len(attempts)
    correct_attempts = sum(1 for attempt in attempts if attempt.get("is_correct"))
    total_hints = sum(int(attempt.get("hints_used", 0)) for attempt in attempts)
    total_time = sum(_attempt_time(attempt) for attempt in attempts)

    return {
        "student_id": student_profile.get("student_id"),
        "student_name": student_profile.get("name"),
        "average_mastery": round(sum(mastery_values) / len(mastery_values), 1) if mastery_values else 0,
        "accuracy_rate": round((correct_attempts / total_attempts) * 100, 1) if total_attempts else 0,
        "total_attempts": total_attempts,
        "topics_attempted": len(topics),
        "average_time_seconds": round(total_time / total_attempts, 1) if total_attempts else 0,
        "hint_dependency": round(total_hints / total_attempts, 2) if total_attempts else 0,
        "misconception_count": sum(
            1
            for topic in topics.values()
            for count in topic.get("error_types", {}).values()
            if count >= 3
        ),
    }


def mastery_distribution(student_profile: dict) -> dict:
    distribution = {"strong": 0, "medium": 0, "weak": 0, "not_started": 0}
    for topic in student_profile.get("topics", {}).values():
        mastery = topic.get("mastery_score", 0)
        if mastery >= 80:
            distribution["strong"] += 1
        elif mastery >= 50:
            distribution["medium"] += 1
        elif mastery > 0:
            distribution["weak"] += 1
        else:
            distribution["not_started"] += 1
    return distribution


def prerequisites_by_concept(graph_data: dict) -> dict[str, list[str]]:
    prerequisites: dict[str, set[str]] = defaultdict(set)
    for node in graph_data.get("nodes", []):
        concept_id = node.get("id")
        if not concept_id:
            continue
        prerequisites.setdefault(concept_id, set())
        for prerequisite in node.get("prerequisites", []):
            prerequisites[concept_id].add(prerequisite)

    for edge in graph_data.get("edges", []):
        source = edge.get("from")
        target = edge.get("to")
        if source and target:
            prerequisites[target].add(source)
            prerequisites.setdefault(source, set())

    return {concept: sorted(values) for concept, values in prerequisites.items()}


def weak_area_ranking(student_profile: dict, graph_data: dict) -> list[dict]:
    topics = student_profile.get("topics", {})
    prerequisites = prerequisites_by_concept(graph_data)
    ranked = []

    for concept_id, topic in topics.items():
        mastery = topic.get("mastery_score", 0)
        error_total = sum(topic.get("error_types", {}).values())
        hint_total = topic.get("hints_used", 0)
        blocking = [
            downstream
            for downstream, prereqs in prerequisites.items()
            if concept_id in prereqs
        ]
        priority = (100 - mastery) + (error_total * 8) + (hint_total * 2) + (len(blocking) * 5)
        ranked.append(
            {
                "concept_id": concept_id,
                "mastery": round(mastery, 1),
                "status": topic.get("status", "unknown"),
                "error_count": error_total,
                "hints_used": hint_total,
                "blocks": blocking,
                "priority_score": round(priority, 1),
                "reason": _weak_area_reason(concept_id, mastery, error_total, blocking),
            }
        )

    return sorted(ranked, key=lambda item: item["priority_score"], reverse=True)


def _weak_area_reason(concept_id: str, mastery: float, error_total: int, blocking: list[str]) -> str:
    parts = []
    if mastery < 50:
        parts.append(f"low mastery in {concept_id}")
    if error_total:
        parts.append(f"{error_total} recorded mistakes")
    if blocking:
        parts.append(f"blocks {', '.join(blocking)}")
    return "; ".join(parts) if parts else "stable progress"


def misconception_ranking(student_profile: dict) -> list[dict]:
    misconceptions = []
    for concept_id, topic in student_profile.get("topics", {}).items():
        for error_type, count in topic.get("error_types", {}).items():
            misconceptions.append(
                {
                    "concept_id": concept_id,
                    "error_type": error_type,
                    "count": count,
                    "severity": "high" if count >= 3 else "watch",
                }
            )
    return sorted(misconceptions, key=lambda item: item["count"], reverse=True)


def learning_velocity(student_profile: dict) -> list[dict]:
    attempts = student_profile.get("attempt_history", [])
    velocity = []
    correct_so_far = 0
    topic_attempts: Counter[str] = Counter()
    topic_correct: Counter[str] = Counter()

    for index, attempt in enumerate(attempts, start=1):
        topic = _safe_topic_name(attempt)
        is_correct = bool(attempt.get("is_correct"))
        correct_so_far += 1 if is_correct else 0
        topic_attempts[topic] += 1
        topic_correct[topic] += 1 if is_correct else 0
        velocity.append(
            {
                "step": index,
                "date": _attempt_date(attempt),
                "topic": topic,
                "cumulative_accuracy": round((correct_so_far / index) * 100, 1),
                "topic_accuracy": round((topic_correct[topic] / topic_attempts[topic]) * 100, 1),
            }
        )

    return velocity


def study_heatmap(student_profile: dict) -> list[dict]:
    by_date: Counter[str] = Counter(_attempt_date(attempt) for attempt in student_profile.get("attempt_history", []))
    return [
        {
            "date": date,
            "attempts": count,
            "intensity": min(4, count),
        }
        for date, count in sorted(by_date.items())
    ]


def graph_summary(graph_data: dict, student_profile: dict) -> dict:
    topics = student_profile.get("topics", {})
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    prereqs = prerequisites_by_concept(graph_data)
    bottlenecks = []

    for concept_id, prerequisites in prereqs.items():
        weak_prereqs = [
            prereq
            for prereq in prerequisites
            if topics.get(prereq, {}).get("mastery_score", 0) < 60
        ]
        if weak_prereqs:
            bottlenecks.append({"concept_id": concept_id, "weak_prerequisites": weak_prereqs})

    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "covered_topics": sum(1 for node in nodes if node.get("id") in topics),
        "bottlenecks": bottlenecks,
        "source": "Context Engine graph",
    }


def generative_suggestions(
    student_profile: dict,
    adaptive_recommendation: Optional[dict],
    misconceptions: list[dict],
    weak_areas: list[dict],
) -> list[dict]:
    suggestions = []
    if adaptive_recommendation:
        concept = adaptive_recommendation.get("recommended_concept") or adaptive_recommendation.get("concept_id")
        action = adaptive_recommendation.get("next_action", "practice")
        suggestions.append(
            {
                "type": "adaptive_study_set",
                "title": f"Generate a focused {action.replace('_', ' ')} set",
                "target_concept": concept,
                "reason": adaptive_recommendation.get("reason", "Matches the adaptive recommendation."),
            }
        )

    if misconceptions:
        top = misconceptions[0]
        suggestions.append(
            {
                "type": "misconception_quiz",
                "title": f"Create misconception-aware questions for {top['error_type']}",
                "target_concept": top["concept_id"],
                "reason": f"{top['error_type']} appeared {top['count']} times.",
            }
        )

    if weak_areas:
        top_weak = weak_areas[0]
        suggestions.append(
            {
                "type": "flashcards",
                "title": f"Generate quick flashcards for {top_weak['concept_id']}",
                "target_concept": top_weak["concept_id"],
                "reason": top_weak["reason"],
            }
        )

    return suggestions


def revision_plan(student_profile: dict, due_flashcards: list[dict] | None = None) -> list[dict]:
    due_flashcards = due_flashcards or []
    today_items = []
    now = datetime.now().date()
    for concept_id, topic in student_profile.get("topics", {}).items():
        review_date = topic.get("next_review_date")
        if not review_date:
            continue
        try:
            due_date = datetime.strptime(review_date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if due_date <= now:
            today_items.append(
                {
                    "type": "concept_review",
                    "concept_id": concept_id,
                    "next_review_date": review_date,
                    "reason": f"{concept_id} is due for spaced review.",
                }
            )

    for record in due_flashcards:
        today_items.append(
            {
                "type": "flashcard_review",
                "concept_id": record["concept_id"],
                "card_id": record["card_id"],
                "next_review_date": record["next_review_date"],
                "reason": f"Flashcard was rated {record['rating']} and is due again.",
            }
        )
    return today_items


def build_dashboard_summary(
    student_profile: dict,
    graph_data: dict,
    adaptive_recommendation: Optional[dict] = None,
    due_flashcards: Optional[list[dict]] = None,
    source_summary: Optional[dict] = None,
) -> dict[str, Any]:
    weak_areas = weak_area_ranking(student_profile, graph_data)
    misconceptions = misconception_ranking(student_profile)
    return {
        "summary": summarize_student(student_profile),
        "mastery_distribution": mastery_distribution(student_profile),
        "weak_areas": weak_areas,
        "misconceptions": misconceptions,
        "learning_velocity": learning_velocity(student_profile),
        "study_heatmap": study_heatmap(student_profile),
        "context_graph": graph_summary(graph_data, student_profile),
        "source_organization": source_summary or {},
        "revision_plan": revision_plan(student_profile, due_flashcards),
        "adaptive_recommendation": adaptive_recommendation,
        "generative_suggestions": generative_suggestions(
            student_profile,
            adaptive_recommendation,
            misconceptions,
            weak_areas,
        ),
        "engine_connections": [
            "Student Model Engine: mastery, attempts, hints, errors",
            "Context Engine: concept graph and prerequisites",
            "Adaptive Engine: readiness, next action, forgetting risk",
            "Generative Engine: suggested study artifacts",
        ],
    }
