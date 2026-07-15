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
        "- \"graph\": nodes and edges (a NETWORK/hierarchy diagram, NOT a plotted curve). Set "
        "\"layout\": \"tree\" for anything hierarchical — binary trees, AVL/red-black trees, "
        "decision trees, org charts, file systems, process/CPU scheduling trees, mind maps with a "
        "clear root. Use \"layout\": \"force\" (or omit it) for flowcharts, concept maps, network "
        "topology, system architecture, database ER diagrams, linked lists, stacks/queues, "
        "API/software architecture, and git branch graphs — anything that is a general network "
        "rather than a strict hierarchy.\n"
        "- \"equation\": a formula built up in progressive stages\n"
        "- \"comparison\": a table contrasting two or more things\n"
        "- \"timeline\": a sequence of events or stages (roadmaps, git history, algorithm steps "
        "that don't need a diagram)\n"
        "- \"chart\": a bar or line chart of DISCRETE/categorical numeric values (statistics, "
        "data-science metrics, performance/complexity comparisons across labelled categories). "
        "Use it for data, NOT for plotting a mathematical function.\n"
        "- \"plot\": a continuous function graph on a real Cartesian grid with x/y axes and "
        "gridlines (like Desmos). USE THIS whenever the student asks to \"graph\", \"plot\", or "
        "\"draw\" a mathematical function or equation — y = mx + c, quadratics, exponential/growth "
        "curves, trig, etc. Give the function(s) as an expression in terms of x; the whiteboard "
        "evaluates and draws the smooth curve itself, so you do NOT compute points.\n\n"
        "CRITICAL: When the request is to plot/graph/draw a FUNCTION or EQUATION, you MUST use the "
        "\"plot\" type. NEVER use the node \"graph\" type for a function — that is only for "
        "networks, trees, and flowcharts, never for a curve on a coordinate plane.\n\n"
        "Break the explanation into 3 to 6 progressive steps. Each step has a short narration "
        "(what the tutor says at that moment) plus the FULL visual state to show at that point "
        "(not a diff from the previous step — always the complete picture so far).\n\n"
        "Match this exact JSON shape:\n"
        "{\n"
        '  "title": "short concept title",\n'
        '  "visualization": "graph" | "equation" | "comparison" | "timeline" | "chart" | "plot",\n'
        '  "steps": [\n'
        "    {\n"
        '      "narration": "one or two sentences the tutor says at this step",\n'
        '      "graph": {"directed": true, "layout": "tree", "nodes": [{"id": "a", "label": "Start", "highlight": false}], '
        '"edges": [{"from": "a", "to": "b", "label": "", "highlight": false}]},\n'
        '      "equation": {"latex": "x^2 + y^2 = r^2", "highlightTerms": ["r^2"]},\n'
        '      "comparison": {"columns": ["Trait", "A", "B"], "rows": [{"label": "Speed", "values": ["Fast", "Slow"]}]},\n'
        '      "timeline": {"events": [{"label": "Step 1", "detail": "...", "active": true}]},\n'
        '      "chart": {"kind": "bar", "unit": "ms", "points": [{"label": "n=10", "value": 4, "highlight": false}]},\n'
        '      "plot": {"functions": [{"expr": "-x + 1", "label": "y = -x + 1", "highlight": true}], '
        '"xRange": [-5, 5], "points": [{"x": 0, "y": 1, "label": "y-intercept"}]}\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Only include the ONE key inside each step object that matches your chosen visualization "
        "type (omit the others). For \"plot\", write expr in terms of x using ^ for powers and "
        "functions like sin, cos, sqrt, exp, ln (e.g. \"x^2\", \"2*sin(x)\", \"exp(x)\"); pick an "
        "xRange that shows the interesting behaviour. Keep labels and narration short, concrete, "
        "and student-friendly — this is being drawn live on a whiteboard, not read as an essay."
    ),
}


def _get_chat_client() -> OpenAI:
    """Create an OpenAI client for the cloud chat model, using the chatbot-specific API key."""
    return OpenAI(
        base_url=settings.OLLAMA_CLOUD_URL,
        api_key=settings.CHAT_API_KEY,
        # Local models generating a full canvas scene can take 30–60s on
        # modest hardware; a tight timeout would cut them off mid-generation.
        timeout=180.0,
    )


def _chat_model_candidates() -> list[str]:
    """Return the configured chat model."""
    model_name = (settings.CHAT_MODEL or "").strip().strip('"').strip("'")
    return [model_name] if model_name else []


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
        f"Let's work through **{concept_label}** using your uploaded material.",
    ]

    if source_context:
        first_source = source_context.split("\n\n")[0]
        parts.append(f"The strongest clue I found in your source is:\n{first_source[:900]}")
    elif graph_context:
        parts.append(f"From your knowledge graph, this is the useful context:\n{graph_context}")

    if "misconception" in student_context.lower() or "error patterns" in student_context.lower():
        parts.append(
            "I notice this idea has caused mistakes before, so let's slow down and fix the exact misunderstanding before adding harder practice."
        )
    elif student_context:
        parts.append(f"Your learning signal says:\n{student_context[:650]}")

    if mode == "test":
        parts.append(f"Try this: explain {concept_label} in your own words, then compare your answer with the source clue above.")
    elif mode == "flashcard":
        parts.append(f"I made the recall cards below. Before flipping each one, say your answer out loud, then check what the source supports.")
    elif mode == "socratic":
        parts.append(f"Let's start with one question: what part of the source clue tells you why {concept_label} matters?")
    else:
        parts.append(f"Next, tell me which part feels unclear, or ask me to turn this into a quiz or flashcards.")

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

    prompt = f"""You are Knowlify Tutor, a warm, interactive learning coach. You help students learn concepts from their uploaded knowledge sources.

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
4. Sound like a real tutor in conversation: direct, friendly, and specific. Avoid template phrases.
5. Never mention internal failures, fallback systems, APIs, models, or default responses to the student.
6. If the student asks about something not covered in their sources, say so honestly and offer a source-grounded next step.
7. Be encouraging but honest. Celebrate progress without overdoing it.
8. Keep responses focused and not too long (3-5 paragraphs max unless step-by-step).
9. If there are misconceptions flagged, address them gently and naturally.
10. If prerequisites are weak, offer to review them before advancing.
11. End with one useful next move or one short check-in question, not a long menu.
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

    # Canvas replies must be a single JSON object. Asking the model for JSON
    # mode makes even smaller local models emit syntactically valid JSON
    # (no prose, no markdown fences), which the scene parser then renders.
    extra_kwargs: dict = {}
    if mode == "canvas":
        extra_kwargs["response_format"] = {"type": "json_object"}

    for model_name in _chat_model_candidates():
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.55,
                max_tokens=1500,
                **extra_kwargs,
            )
            return response.choices[0].message.content or "I'm sorry, I couldn't generate a response."
        except Exception as exc:
            if first_error is None:
                first_error = exc
            print(f"[chat_engine] Model '{model_name}' failed: {exc}")

    if first_error:
        raise first_error
    raise RuntimeError("No chat model is configured.")
