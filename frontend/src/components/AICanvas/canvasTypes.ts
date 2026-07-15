/**
 * AI Canvas — shared types.
 *
 * Mirrors the JSON scene shape the backend's `canvas` chat mode is instructed
 * to return (see `backend/app/engines/generative/chat_engine.py`
 * MODE_INSTRUCTIONS["canvas"]). Kept as a single source of truth so the
 * renderer picked for `visualization` always matches what the step carries.
 */

export type CanvasVisualization =
  | 'graph'
  | 'equation'
  | 'comparison'
  | 'timeline'
  | 'chart'
  | 'plot'
  | 'mindmap'
  | 'infographic'
  | 'video';

/** Every visualization's step-payload key is the same string as the type. */
export const VISUALIZATION_TYPES: CanvasVisualization[] = [
  'graph',
  'equation',
  'comparison',
  'timeline',
  'chart',
  'plot',
  'mindmap',
  'infographic',
  'video',
];

export interface CanvasGraphNode {
  id: string;
  label: string;
  highlight?: boolean;
  /** Persisted canvas position (set when the user drags the node). */
  x?: number;
  y?: number;
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

/**
 * Mind map — a central idea with branches. Modelled as a flat parent-pointer
 * tree (every node names its parent) so it's trivial for the LLM to emit and
 * for us to validate, while still rendering as a real radial/hierarchical map.
 */
export interface CanvasMindMapNode {
  id: string;
  label: string;
  /** null / omitted → a top-level branch off the root. */
  parentId?: string | null;
  /** Optional longer explanation shown in the inspector. */
  note?: string;
  /** Optional branch color hint. */
  color?: string;
  x?: number;
  y?: number;
}

export interface CanvasMindMapPayload {
  /** Label of the central node. */
  root: string;
  nodes: CanvasMindMapNode[];
}

/** A single content block on a study infographic poster. */
export type CanvasInfographicBlock =
  | { kind: 'stat'; value: string; label: string; trend?: string; icon?: string }
  | { kind: 'facts'; heading?: string; items: Array<{ icon?: string; text: string }> }
  | { kind: 'process'; heading?: string; steps: string[] }
  | {
      kind: 'compare';
      heading?: string;
      left: { title: string; items: string[] };
      right: { title: string; items: string[] };
    }
  | { kind: 'quote'; text: string; source?: string }
  | { kind: 'formula'; latex: string; caption?: string };

export interface CanvasInfographicPayload {
  theme?: 'warm' | 'cool' | 'mono';
  title: string;
  subtitle?: string;
  blocks: CanvasInfographicBlock[];
}

/** An animated element on the video timeline. */
export type CanvasVideoElementKind =
  | 'text'
  | 'latex'
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'plot';

/** One keyframe. All positions are in 0–100 percent of the canvas. */
export interface CanvasVideoKeyframe {
  at: number; // seconds
  x: number; // 0–100
  y: number; // 0–100
  scale?: number;
  opacity?: number;
  rotate?: number; // degrees
}

export interface CanvasVideoElement {
  id: string;
  kind: CanvasVideoElementKind;
  props: {
    text?: string;
    latex?: string;
    /** Function expression in terms of x, for kind: 'plot'. */
    expr?: string;
    color?: string;
    fontSize?: number; // px at scale 1
    width?: number; // percent, for rect
    height?: number; // percent, for rect
    radius?: number; // percent of min dimension, for circle
    x2?: number; // percent, endpoint for line/arrow
    y2?: number; // percent, endpoint for line/arrow
  };
  keyframes: CanvasVideoKeyframe[];
}

export interface CanvasVideoCaption {
  at: number;
  end: number;
  text: string;
}

export interface CanvasVideoPayload {
  /** Total length in seconds (clamped to a sane max by the renderer). */
  duration: number;
  background?: string;
  elements: CanvasVideoElement[];
  captions?: CanvasVideoCaption[];
}

export interface CanvasStep {
  narration: string;
  graph?: CanvasGraphPayload;
  equation?: CanvasEquationPayload;
  comparison?: CanvasComparisonPayload;
  timeline?: CanvasTimelinePayload;
  chart?: CanvasChartPayload;
  plot?: CanvasPlotPayload;
  mindmap?: CanvasMindMapPayload;
  infographic?: CanvasInfographicPayload;
  video?: CanvasVideoPayload;
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

/** What the user currently has selected for inspection/editing. */
export type CanvasSelection =
  | { type: 'node'; id: string }
  | { type: 'chartPoint'; index: number }
  | { type: 'timelineEvent'; index: number }
  | { type: 'comparisonRow'; index: number }
  | null;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/** Which visualization payload key (if any) a raw step object carries. */
function stepPayloadKey(step: unknown): CanvasVisualization | null {
  if (!isRecord(step)) return null;
  for (const type of VISUALIZATION_TYPES) {
    if (isRecord(step[type])) return type;
  }
  return null;
}

/**
 * Coerce a raw scene object from the backend into a renderable `CanvasScene`,
 * or `null` if nothing usable is present.
 *
 * This fixes the historical "blank card" bug: previously CanvasStage required
 * `scene.visualization === X && step.X`, so a scene whose declared type didn't
 * match the payload its steps actually carried rendered nothing at all. Here we
 * trust the payloads — if the declared `visualization` has no matching steps we
 * infer the real type from the steps — and drop any steps that carry no
 * renderable payload.
 */
export function normalizeScene(raw: unknown): CanvasScene | null {
  if (!isRecord(raw)) return null;
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : null;
  if (!rawSteps || rawSteps.length === 0) return null;

  const declared = VISUALIZATION_TYPES.includes(raw.visualization as CanvasVisualization)
    ? (raw.visualization as CanvasVisualization)
    : null;

  // Tally which payload types the steps actually contain.
  const counts = new Map<CanvasVisualization, number>();
  for (const step of rawSteps) {
    const key = stepPayloadKey(step);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let visualization = declared;
  if (!visualization || !counts.get(visualization)) {
    // Declared type is missing or has zero matching steps — trust the payloads.
    let best: CanvasVisualization | null = null;
    let bestCount = 0;
    for (const [type, count] of counts) {
      if (count > bestCount) {
        best = type;
        bestCount = count;
      }
    }
    visualization = best;
  }
  if (!visualization) return null;

  const vis = visualization;
  const steps: CanvasStep[] = rawSteps
    .filter((step): step is Record<string, unknown> => isRecord(step) && isRecord(step[vis]))
    .map((step) => ({
      narration: typeof step.narration === 'string' ? step.narration : '',
      [vis]: step[vis],
    })) as CanvasStep[];

  if (steps.length === 0) return null;

  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Concept',
    visualization: vis,
    steps,
  };
}
