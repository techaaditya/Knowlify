from app.engines.dashboard import dashboard_engine
from app.routers.dashboard import choose_recommendation_concept, empty_student_profile, graph_has_data


def sample_student():
    return {
        "student_id": "S001",
        "name": "Alex Johnson",
        "topics": {
            "Limits": {
                "mastery_score": 72.5,
                "status": "learning",
                "hints_used": 3,
                "error_types": {"Sign error": 1},
            },
            "Derivatives": {
                "mastery_score": 13,
                "status": "weak",
                "hints_used": 5,
                "error_types": {"Formula mistake": 3},
            },
        },
        "attempt_history": [
            {
                "topic": "Limits",
                "question_id": "Q1",
                "is_correct": True,
                "hints_used": 0,
                "time_taken": 40,
                "attempted_at": "2026-06-04 15:37:49",
            },
            {
                "topic": "Derivatives",
                "question_id": "Q2",
                "is_correct": False,
                "hints_used": 2,
                "time_taken": 90,
                "attempted_at": "2026-06-04 15:40:49",
            },
        ],
    }


def sample_graph():
    return {
        "nodes": [{"id": "Limits"}, {"id": "Derivatives"}, {"id": "Chain Rule"}],
        "edges": [
            {"from": "Limits", "to": "Derivatives"},
            {"from": "Derivatives", "to": "Chain Rule"},
        ],
    }


def test_dashboard_summary_calculates_core_metrics():
    summary = dashboard_engine.summarize_student(sample_student())

    assert summary["average_mastery"] == 42.8
    assert summary["accuracy_rate"] == 50.0
    assert summary["total_attempts"] == 2
    assert summary["misconception_count"] == 1


def test_weak_area_ranking_prioritizes_low_mastery_blocker():
    weak_areas = dashboard_engine.weak_area_ranking(sample_student(), sample_graph())

    assert weak_areas[0]["concept_id"] == "Derivatives"
    assert "Chain Rule" in weak_areas[0]["blocks"]


def test_dashboard_builds_velocity_heatmap_and_suggestions():
    adaptive_recommendation = {
        "concept_id": "Derivatives",
        "concept_name": "Derivatives",
        "next_action": "reteach",
        "recommended_concept": "Derivatives",
        "reason": "Repeated formula mistakes.",
    }

    dashboard = dashboard_engine.build_dashboard_summary(
        sample_student(),
        sample_graph(),
        adaptive_recommendation=adaptive_recommendation,
    )

    assert dashboard["learning_velocity"][0]["cumulative_accuracy"] == 100.0
    assert dashboard["study_heatmap"][0]["attempts"] == 2
    assert dashboard["context_graph"]["edge_count"] == 2
    assert dashboard["generative_suggestions"]


def test_dashboard_uses_lowest_mastery_concept_from_context_graph():
    student = sample_student()
    student["topics"]["Organic Chemistry"] = {
        "mastery_score": 8,
        "status": "weak",
        "hints_used": 4,
        "error_types": {"Mechanism error": 2},
    }
    graph = {
        "nodes": [{"id": "Derivatives"}, {"id": "Organic Chemistry"}],
        "edges": [],
    }

    assert graph_has_data(graph) is True
    assert choose_recommendation_concept(student, graph) == "Organic Chemistry"


def test_new_dashboard_profile_contains_no_demo_attempts():
    profile = empty_student_profile("student-1")

    assert profile["student_id"] == "student-1"
    assert profile["topics"] == {}
    assert profile["attempt_history"] == []
