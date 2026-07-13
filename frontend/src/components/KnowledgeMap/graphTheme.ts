/**
 * Presentation-only helpers for the Knowledge Graph redesign.
 *
 * Nothing here touches graph algorithms, physics, or data fetching — these are
 * pure functions that derive *visual* state (category/lock/recommendation,
 * confidence, formatted study time) from the same data the graph already
 * consumes (`GraphNode`, the student's `topics` map). The underlying store
 * contracts (`useStudyStore`, `useUserStore`) are untouched.
 */
import type { GraphEdge, GraphNode } from '../../store/studyStore';

export type NodeCategory = 'mastered' | 'learning' | 'weak' | 'locked';

export interface TopicStat {
  mastery_score: number;
  total_attempts: number;
  correct_answers: number;
  wrong_answers: number;
  hints_used: number;
  total_time_taken: number;
  status: string;
  error_types: Record<string, number>;
  last_revised: string | null;
}

// Thresholds shared with the rest of the app's mastery language.
export const MASTERED_AT = 80;
export const LEARNING_AT = 50;

// Mirrors the app's existing warm-alabaster mastery palette (index.css
// --strong-*/--medium-*/--weak-*/--unstarted-* vars) — the graph should look
// like the rest of Knowlify, not a different dark product.
export const NODE_PALETTE: Record<NodeCategory, {
  core: string; glow: string; ring: string; text: string; icon: string;
}> = {
  mastered: { core: '#EEF2ED', glow: 'rgba(143, 158, 139, 0.35)', ring: '#8F9E8B', text: '#4E5A4A', icon: '✓' },
  learning: { core: '#FAF5EE', glow: 'rgba(197, 180, 155, 0.35)', ring: '#C5B49B', text: '#766751', icon: '◐' },
  weak:     { core: '#FBF0EE', glow: 'rgba(197, 143, 132, 0.4)', ring: '#C58F84', text: '#7C4940', icon: '!' },
  locked:   { core: '#F5F3ED', glow: 'rgba(190, 183, 164, 0.2)', ring: '#BEB7A4', text: '#9E978C', icon: '🔒' },
};

export const RECOMMENDED_GLOW = 'rgba(188, 168, 138, 0.55)';
export const RECOMMENDED_RING = '#BCA88A';

/**
 * Traffic-light colors for the graph's edges/branches — a clearer, more
 * saturated read than the node badges' muted hues, so mastery status is
 * legible on thin lines at a glance: red = poor, yellow = average, green =
 * excellent. Locked stays neutral since there's no grade yet.
 */
export const EDGE_STATUS_COLOR: Record<NodeCategory, string> = {
  weak: '#C0574A',      // red — poor
  learning: '#D9A441',  // yellow — average
  mastered: '#7A9471',  // green — excellent
  locked: '#BEB7A4',    // neutral — not started
};

/** Hex (#rrggbb) → rgba() string at the given alpha. */
export const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Are every one of this node's prerequisites at mastered level? */
const prereqsMastered = (
  prereqIds: string[],
  topics: Record<string, TopicStat>,
): boolean => prereqIds.every((id) => (topics[id]?.mastery_score ?? 0) >= MASTERED_AT);

export const categoryFor = (
  node: GraphNode,
  topics: Record<string, TopicStat>,
): NodeCategory => {
  const mastery = topics[node.id]?.mastery_score ?? 0;
  if (mastery >= MASTERED_AT) return 'mastered';
  if (mastery >= LEARNING_AT) return 'learning';
  if (mastery > 0) return 'weak';
  // Never started: ready to learn if prerequisites are cleared, else locked.
  return prereqsMastered(node.prerequisites, topics) ? 'learning' : 'locked';
};

/**
 * Client-side "what's next" heuristic: the easiest unlocked-but-unstarted
 * concept. Purely derived from data already on the graph/student model — no
 * new network calls, so this stays a presentation concern.
 */
export const recommendNextId = (
  nodes: GraphNode[],
  topics: Record<string, TopicStat>,
): string | null => {
  const ready = nodes.filter((n) => {
    const mastery = topics[n.id]?.mastery_score ?? 0;
    return mastery === 0 && prereqsMastered(n.prerequisites, topics);
  });
  if (ready.length === 0) return null;
  return ready.sort((a, b) => a.difficulty - b.difficulty)[0].id;
};

/** Accuracy over attempts, as a 0..100 "confidence" proxy — no new data needed. */
export const confidenceFor = (topic: TopicStat | undefined): number | null => {
  if (!topic || topic.total_attempts <= 0) return null;
  return Math.round((topic.correct_answers / topic.total_attempts) * 100);
};

export const formatStudyTime = (seconds: number | undefined): string => {
  if (!seconds || seconds <= 0) return 'Not started';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
};

export const formatLastRevised = (iso: string | null | undefined): string => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const neighborsOf = (
  nodeId: string,
  edges: GraphEdge[],
): { prerequisiteOf: string[]; unlocks: string[] } => ({
  prerequisiteOf: edges.filter((e) => e.to === nodeId).map((e) => e.from),
  unlocks: edges.filter((e) => e.from === nodeId).map((e) => e.to),
});
