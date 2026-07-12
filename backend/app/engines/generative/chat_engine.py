"""Adaptive Chat Engine — LLM-powered tutoring grounded in workspace sources."""

from __future__ import annotations

import os
from typing import Optional
from openai import OpenAI

from ...config import settings


# ---------------------------------------------------------------------------
# Learning mode instructions injected into the system prompt
# ---------------------------------------------------------------------------

MODE_INSTRUCTIONS = {
    "explain": (
        "Explain the concept in simple, clear language appropriate to the student's "
        "current mastery level. Use analogies and everyday examples. "
        "Keep the explanation concise (2-4 paragraphs)."
    ),
    "step_by_step": (
        "Teach the concept step-by-step with numbered steps. "
        "After every 2-3 steps, pause and ask the student if they follow before continuing. "
        "Use checkpoints like 'Does this step make sense so far?'"
    ),
    "socratic": (
        "You are a Socratic tutor. NEVER give the answer directly. "
        "Instead, ask guiding questions that lead the student to discover the answer themselves. "
        "Start with what they already know, then ask questions that reveal gaps."
    ),
    "example": (
        "Provide a fully worked example demonstrating the concept. "
        "Show every step of the solution with clear explanations for each step. "
        "After the example, ask the student to try a similar problem."
    ),
    "flashcard": (
        "Generate 4-5 flashcard-style Q&A pairs about this concept. "
        "Format each as:\n**Q:** [question]\n**A:** [answer]\n"
        "Cover definitions, relationships, and applications."
    ),
    "test": (
        "Generate ONE multiple-choice question about this concept with 4 options (A-D). "
        "Format it clearly with the question first, then options on separate lines. "
        "Do NOT reveal the correct answer. Wait for the student to respond. "
        "After they answer, tell them if they're correct and explain why."
    ),
    "canvas": (
        "You are building a visual, step-by-step explanation for an AI whiteboard (the AI Canvas). "
        "Respond with ONLY a single valid JSON object — no prose, no markdown code fences, "
        "no commentary before or after it.\n\n"
        "Choose exactly ONE visualization type that best explains this concept:\n"
        "- \"graph\": a flowchart or concept map made of nodes and edges\n"
        "- \"equation\": a formula built up in progressive stages\n"
        "- \"comparison\": a table contrasting two or more things\n"
        "- \"timeline\": a sequence of events or stages\n\n"
        "Break the explanation into 3 to 6 progressive steps. Each step has a short narration "
        "(what the tutor says at that moment) plus the FULL visual state to show at that point "
        "(not a diff from the previous step — always the complete picture so far).\n\n"
        "Match this exact JSON shape:\n"
        "{\n"
        '  "title": "short concept title",\n'
        '  "visualization": "graph" | "equation" | "comparison" | "timeline",\n'
        '  "steps": [\n'
        "    {\n"
        '      "narration": "one or two sentences the tutor says at this step",\n'
        '      "graph": {"directed": true, "nodes": [{"id": "a", "label": "Start", "highlight": false}], '
        '"edges": [{"from": "a", "to": "b", "label": "", "highlight": false}]},\n'
        '      "equation": {"latex": "x^2 + y^2 = r^2", "highlightTerms": ["r^2"]},\n'
        '      "comparison": {"columns": ["Trait", "A", "B"], "rows": [{"label": "Speed", "values": ["Fast", "Slow"]}]},\n'
        '      "timeline": {"events": [{"label": "Step 1", "detail": "...", "active": true}]}\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Only include the ONE key inside each step object that matches your chosen visualization "
        "type (omit the other three). Keep node labels and narration short, concrete, and "
        "student-friendly — this is being drawn live on a whiteboard, not read as an essay."
    ),
}


def _get_chat_client() -> OpenAI:
    """Create an OpenAI client using the chatbot-specific API key."""
    return OpenAI(
        base_url=settings.OLLAMA_BASE_URL,
        api_key=settings.CHAT_API_KEY,
        timeout=60.0,
    )


def _chat_model_candidates() -> list[str]:
    """Return primary and local fallback chat models without duplicates."""
    candidates = [
        settings.CHAT_MODEL,
        settings.CHAT_FALLBACK_MODEL,
    ]
    seen = set()
    unique = []
    for model in candidates:
        model_name = (model or "").strip().strip('"').strip("'")
        if model_name and model_name not in seen:
            seen.add(model_name)
            unique.append(model_name)
    return unique


def build_source_context(
    sources: list[dict],
    concept_id: str | None,
    retrieved_chunks: list[dict] | None = None,
) -> str:
    """Extract relevant text snippets from selected sources for grounding."""
    context_parts = []

    if retrieved_chunks:
        for chunk in retrieved_chunks:
            name = chunk.get("source_name", "Unknown Source")
            page = chunk.get("page_number")
            page_label = f", page {page}" if page else ""
            snippet = chunk.get("snippet", "")
            keywords = chunk.get("keywords") or []
            context_parts.append(
                f"[Relevant source: {name}{page_label}]\n"
                f"Snippet: {snippet}\n"
                f"Matched keywords: {', '.join(keywords)}"
            )

    for source in sources:
        name = source.get("source_name", "Unknown Source")
        summary = source.get("ai_summary", "")
        key_topics = source.get("key_topics", [])
        extracted_text = source.get("extracted_text", "")

        # Include summary and topics
        if summary:
            context_parts.append(f"[Source: {name}]\nSummary: {summary}")
        if key_topics:
            context_parts.append(f"Key topics in '{name}': {', '.join(key_topics)}")

        # Keep full-source fallback short because ranked chunks are preferred.
        if extracted_text and not retrieved_chunks:
            # Limit to first 2000 chars to stay within token budgets
            snippet = extracted_text[:2000]
            if len(extracted_text) > 2000:
                snippet += "..."
            context_parts.append(f"Content from '{name}':\n{snippet}")

    return "\n\n".join(context_parts) if context_parts else ""


def generate_fallback_chat_response(
    message: str,
    mode: str = "explain",
    source_context: str = "",
    graph_context: str = "",
    student_context: str = "",
    concept_name: str | None = None,
) -> str:
    """Deterministic response used when Ollama/LLM is unavailable."""
    concept_label = concept_name or "this topic"
    parts = [
        "I could not reach the local tutoring model, so I am using Knowlify's source-based fallback.",
        f"For **{concept_label}**, I will stay close to the uploaded source and your learning data.",
    ]

    if source_context:
        first_source = source_context.split("\n\n")[0]
        parts.append(f"Most relevant source evidence:\n{first_source[:900]}")
    elif graph_context:
        parts.append(f"Knowledge graph signal:\n{graph_context}")

    if "misconception" in student_context.lower() or "error patterns" in student_context.lower():
        parts.append(
            "Your Student Model shows repeated error patterns, so the next response should focus on the misconception before adding harder practice."
        )
    elif student_context:
        parts.append(f"Student/adaptive signal:\n{student_context[:650]}")

    if mode == "test":
        parts.append(f"Practice prompt: explain {concept_label} in your own words, then compare your answer with the source evidence above.")
    elif mode == "flashcard":
        parts.append(f"Flashcard: What is the key idea of {concept_label}?\nAnswer: Use the source evidence above to state the definition and why it matters.")
    elif mode == "socratic":
        parts.append(f"Guiding question: What part of the source evidence tells you why {concept_label} matters?")
    else:
        parts.append(f"Recommended next step: review the evidence, then ask for a quiz or flashcards on {concept_label}.")

    return "\n\n".join(parts)


def build_graph_context(graph_data: dict, concept_id: str | None) -> str:
    """Build context from the knowledge graph around the active concept."""
    if not graph_data or not graph_data.get("nodes"):
        return ""

    nodes = {n["id"]: n for n in graph_data.get("nodes", []) if isinstance(n, dict)}
    edges = graph_data.get("edges", [])

    parts = []

    if concept_id and concept_id in nodes:
        node = nodes[concept_id]
        display = node.get("display_name", concept_id)
        desc = node.get("description", "")
        diff = node.get("difficulty", "?")
        prereqs = node.get("prerequisites", [])

        parts.append(f"Active concept: {display} (difficulty: {diff}/5)")
        if desc:
            parts.append(f"Description: {desc}")
        if prereqs:
            prereq_names = [nodes.get(p, {}).get("display_name", p) for p in prereqs]
            parts.append(f"Prerequisites: {', '.join(prereq_names)}")

        # Find what this concept unlocks
        unlocks = [
            nodes.get(e["to"], {}).get("display_name", e["to"])
            for e in edges
            if e.get("from") == concept_id and e.get("to") in nodes
        ]
        if unlocks:
            parts.append(f"Unlocks: {', '.join(unlocks)}")
    else:
        # List all concepts in the workspace
        all_names = [n.get("display_name", n["id"]) for n in nodes.values()]
        parts.append(f"Workspace concepts: {', '.join(all_names)}")

    return "\n".join(parts)


def build_student_context(
    student_profile: dict | None,
    concept_id: str | None,
    misconceptions: dict | None,
    recommendation: dict | None,
) -> str:
    """Build context from the Student Model and Adaptive Engine."""
    parts = []

    if student_profile and concept_id:
        topics = student_profile.get("topics", {})
        topic_data = topics.get(concept_id)
        if topic_data:
            mastery = topic_data.get("mastery_score", 0)
            status = topic_data.get("status", "Not Started")
            attempts = topic_data.get("total_attempts", 0)
            correct = topic_data.get("correct_answers", 0)
            wrong = topic_data.get("wrong_answers", 0)
            hints = topic_data.get("hints_used", 0)
            error_types = topic_data.get("error_types", {})

            parts.append(f"Student mastery on this concept: {mastery}% ({status})")
            parts.append(f"Attempts: {attempts} total, {correct} correct, {wrong} wrong, {hints} hints used")

            if error_types:
                error_summary = ", ".join(f"{k} ({v} times)" for k, v in error_types.items())
                parts.append(f"Error patterns: {error_summary}")

        # Include weak topics
        weak_topics = [
            name for name, data in topics.items()
            if data.get("status") == "Weak"
        ]
        if weak_topics:
            parts.append(f"Student's weak topics: {', '.join(weak_topics)}")

    # Misconceptions
    if misconceptions and concept_id and concept_id in misconceptions:
        errors = misconceptions[concept_id]
        parts.append(
            f"⚠️ IMPORTANT: The student has REPEATED misconceptions in this concept: "
            f"{', '.join(errors)}. Gently address these errors in your response. "
            f"For example: 'I noticed you've had some difficulty with {errors[0]}. "
            f"Let's work through that together.'"
        )

    # Adaptive recommendation
    if recommendation:
        next_action = recommendation.get("next_action", "")
        forgetting_risk = recommendation.get("forgetting_risk", "")
        reason = recommendation.get("reason", "")
        weak_prereq = recommendation.get("weakest_prerequisite")
        suggested_activity = recommendation.get("suggested_activity", "")

        if next_action:
            parts.append(f"Adaptive engine recommends: {next_action}")
        if forgetting_risk:
            parts.append(f"Forgetting risk: {forgetting_risk}")
        if reason:
            parts.append(f"Reason: {reason}")
        if weak_prereq:
            parts.append(
                f"⚠️ PREREQUISITE ALERT: The student has a weak prerequisite: '{weak_prereq}'. "
                f"Before diving deep into the current concept, offer a brief review of "
                f"'{weak_prereq}' first."
            )
        if suggested_activity:
            parts.append(f"Suggested activity: {suggested_activity}")

    return "\n".join(parts) if parts else "No student history available for this concept yet."


def build_system_prompt(
    mode: str,
    source_context: str,
    graph_context: str,
    student_context: str,
    concept_name: str | None,
) -> str:
    """Assemble the full system prompt for the LLM."""
    mode_instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["explain"])
    concept_label = concept_name or "the student's workspace topics"

    prompt = f"""You are Knowlify Tutor, an expert adaptive learning assistant. You help students learn concepts from their uploaded knowledge sources.

## Your Current Task
{mode_instruction}

## Active Concept
{concept_label}

## Knowledge Source Context (GROUND YOUR ANSWERS IN THIS)
{source_context if source_context else "No specific source text available. Use the graph context below."}

## Knowledge Graph Context
{graph_context if graph_context else "No graph data available."}

## Student Profile & Adaptive Guidance
{student_context}

## Rules
1. ALWAYS ground your answers in the uploaded source material when possible.
2. When you use information from a source, cite it: "Based on your source 'Source Name'..."
3. Adapt your language complexity to the student's mastery level:
   - Below 30% mastery: Use very simple language, short sentences, basic analogies
   - 30-60% mastery: Use moderate complexity with some technical terms
   - Above 60% mastery: Use full technical language, go deeper
4. If the student asks about something not covered in their sources, say so honestly.
5. Be encouraging but honest. Celebrate progress.
6. Keep responses focused and not too long (3-5 paragraphs max unless step-by-step).
7. If there are misconceptions flagged, address them gently and naturally.
8. If prerequisites are weak, offer to review them before advancing.
"""
    return prompt


def generate_chat_response(
    message: str,
    history: list[dict],
    mode: str = "explain",
    source_context: str = "",
    graph_context: str = "",
    student_context: str = "",
    concept_name: str | None = None,
) -> str:
    """Send the conversation to the LLM and return the response."""
    system_prompt = build_system_prompt(
        mode, source_context, graph_context, student_context, concept_name
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (limit to last 20 messages to manage token usage)
    for msg in history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Add the current message
    messages.append({"role": "user", "content": message})

    client = _get_chat_client()
    first_error: Exception | None = None

    for model_name in _chat_model_candidates():
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.4,
                max_tokens=1500,
            )
            return response.choices[0].message.content or "I'm sorry, I couldn't generate a response."
        except Exception as exc:
            if first_error is None:
                first_error = exc
            print(f"[chat_engine] Model '{model_name}' failed: {exc}")

    if first_error:
        raise first_error
    raise RuntimeError("No chat model is configured.")
