/**
 * AI Canvas — shared types.
 *
 * Mirrors the JSON scene shape the backend's `canvas` chat mode is instructed
 * to return (see `backend/app/engines/generative/chat_engine.py`
 * MODE_INSTRUCTIONS["canvas"]). Kept as a single source of truth so the
 * renderer picked for `visualization` always matches what the step carries.
 */

export type CanvasVisualization = 'graph' | 'equation' | 'comparison' | 'timeline' | 'chart' | 'plot';

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
  /**
   * 'tree' lays the graph out top-down by hierarchy (binary/decision/AVL/
   * red-black trees, org charts, file systems, process trees, mind maps) —
   * without this, all graphs use a force-directed layout, which looks fine
   * for flowcharts/networks but turns genuine trees into unreadable spaghetti.
   */
  layout?: 'tree' | 'force';
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

/** Simple numeric chart — bars or a line series (statistics, data workflows). */
export interface CanvasChartPayload {
  kind: 'bar' | 'line';
  unit?: string;
  points: Array<{ label: string; value: number; highlight?: boolean }>;
}

/**
 * A true function plot on a Cartesian grid (like Desmos) — the right tool for
 * "graph y = mx + c", parabolas, trig, growth curves, etc. Each function is an
 * expression in terms of `x` that the renderer evaluates itself, so the curve
 * is smooth and correct regardless of the model's own arithmetic.
 */
export interface CanvasPlotFunction {
  /** Right-hand side in terms of x, e.g. "-x + 1", "x^2", "2*sin(x)". */
  expr: string;
  /** Human label shown in the legend, e.g. "y = -x + 1". */
  label?: string;
  highlight?: boolean;
}

export interface CanvasPlotPoint {
  x: number;
  y: number;
  label?: string;
}

export interface CanvasPlotPayload {
  functions: CanvasPlotFunction[];
  /** Visible x-domain; defaults to a sensible range around the origin. */
  xRange?: [number, number];
  /** Visible y-range; auto-fit to the sampled curve when omitted. */
  yRange?: [number, number];
  /** Optional highlighted points to mark (intercepts, vertices, …). */
  points?: CanvasPlotPoint[];
}

export interface CanvasStep {
  narration: string;
  graph?: CanvasGraphPayload;
  equation?: CanvasEquationPayload;
  comparison?: CanvasComparisonPayload;
  timeline?: CanvasTimelinePayload;
  chart?: CanvasChartPayload;
  plot?: CanvasPlotPayload;
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
