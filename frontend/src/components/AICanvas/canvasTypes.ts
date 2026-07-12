/**
 * AI Canvas — shared types.
 *
 * Mirrors the JSON scene shape the backend's `canvas` chat mode is instructed
 * to return (see `backend/app/engines/generative/chat_engine.py`
 * MODE_INSTRUCTIONS["canvas"]). Kept as a single source of truth so the
 * renderer picked for `visualization` always matches what the step carries.
 */

export type CanvasVisualization = 'graph' | 'equation' | 'comparison' | 'timeline';

export interface CanvasGraphNode {
  id: string;
  label: string;
  highlight?: boolean;
}

export interface CanvasGraphEdge {
  from: string;
  to: string;
  label?: string;
  highlight?: boolean;
}

export interface CanvasGraphPayload {
  directed?: boolean;
  nodes: CanvasGraphNode[];
  edges: CanvasGraphEdge[];
}

export interface CanvasEquationPayload {
  latex: string;
  highlightTerms?: string[];
}

export interface CanvasComparisonPayload {
  columns: string[];
  rows: Array<{ label: string; values: string[] }>;
}

export interface CanvasTimelineEvent {
  label: string;
  detail?: string;
  active?: boolean;
}

export interface CanvasTimelinePayload {
  events: CanvasTimelineEvent[];
}

export interface CanvasStep {
  narration: string;
  graph?: CanvasGraphPayload;
  equation?: CanvasEquationPayload;
  comparison?: CanvasComparisonPayload;
  timeline?: CanvasTimelinePayload;
}

export interface CanvasScene {
  title: string;
  visualization: CanvasVisualization;
  steps: CanvasStep[];
}

/** One completed teaching scene, kept for this session's memory + summary. */
export interface CanvasHistoryEntry {
  id: string;
  conceptId: string | null;
  prompt: string;
  scene: CanvasScene;
  misconceptions: string[];
  createdAt: number;
}
