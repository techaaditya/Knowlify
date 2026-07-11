/**
 * AI Learning Companion — shared domain types.
 *
 * The Companion is intentionally decoupled from any single rendering of the
 * avatar. Everything downstream (avatar, panel, nudges) is driven by an
 * `CompanionEmotion` plus data snapshots, so a future 3D / voice / AR avatar
 * can be swapped in behind the same interface without touching the brain,
 * the store, or the chat panel.
 */

/** The full emotional range the mentor can express. */
export type CompanionEmotion =
  | 'idle'        // resting, gentle breathing
  | 'happy'       // pleased, warm
  | 'thinking'    // processing, looking up, floating dots
  | 'teaching'    // explaining, leaning in, confident
  | 'celebrating' // achievement — jump + confetti + glow
  | 'concerned'   // gently worried, suggests review
  | 'waiting'     // welcoming back / awaiting the learner
  | 'sleeping'    // long idle — eyes closed, Zzz
  | 'surprised'   // sudden event
  | 'confident'   // high mastery, ready for a challenge
  | 'curious';    // exploring, inquisitive

/** Semantic categories a proactive nudge or quick action can trigger. */
export type CompanionIntent =
  | 'take_quiz'
  | 'generate_summary'
  | 'explain_again'
  | 'visual_explanation'
  | 'practice'
  | 'show_mistakes'
  | 'review_weak'
  | 'challenge'
  | 'next_lesson'
  | 'daily_goal'
  | 'learning_tips'
  | 'open_graph'
  | 'continue'
  | 'ask';

/** A single actionable chip the companion can offer. */
export interface CompanionAction {
  id: string;
  intent: CompanionIntent;
  label: string;
  /** Emoji/icon hint (kept lightweight & swappable). */
  icon?: string;
  /** Optional concept this action targets. */
  conceptId?: string | null;
  /** Prompt text sent to the tutor when the action maps to a chat turn. */
  prompt?: string;
  /** Chat mode to run the tutor in, mirroring the backend's mode ids. */
  mode?: string;
}

/**
 * A proactive, data-driven message the companion surfaces on its own —
 * the thing that makes it a mentor rather than a chatbot waiting for input.
 */
export interface CompanionNudge {
  id: string;
  /** Stable category, used to de-dupe and rate-limit repeats. */
  kind: string;
  emotion: CompanionEmotion;
  /** Short line shown in the floating bubble. */
  text: string;
  /** Higher wins when several nudges are eligible at once. */
  priority: number;
  actions?: CompanionAction[];
  /** If true, the nudge is important enough to re-show even once dismissed. */
  sticky?: boolean;
}

export interface CompanionSource {
  name: string;
}

/** Inline practice quiz attached to a tutor reply (mirrors the /api/chat payload). */
export interface CompanionQuiz {
  id: string;
  conceptId: string;
  prompt: string;
  options: string[];
}

export interface CompanionQuizState {
  answered: boolean;
  selected?: number;
  isCorrect?: boolean;
  explanation?: string;
  correctAnswer?: string;
}

export interface CompanionFlashcard {
  id: string;
  front: string;
  back: string;
}

/** A message in the companion chat thread. */
export interface CompanionChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  emotion?: CompanionEmotion;
  actions?: CompanionAction[];
  sources?: CompanionSource[];
  quiz?: CompanionQuiz | null;
  quizState?: CompanionQuizState;
  flashcards?: CompanionFlashcard[] | null;
  /** Assistant message still streaming / awaiting the model. */
  pending?: boolean;
  createdAt: number;
}

/**
 * Normalised view of the learner derived from the existing Zustand stores +
 * dashboard engine. This is the sole input to the emotion/nudge brain, which
 * keeps the brain a pure function that is trivial to reason about and test.
 */
export interface LearningSnapshot {
  hasData: boolean;
  studentName: string;
  workspaceName: string;
  /** 0..1 */
  averageMastery: number;
  /** 0..1 */
  accuracy: number;
  totalAttempts: number;
  topicsStarted: number;
  topicsTotal: number;
  misconceptionCount: number;
  weakAreas: ConceptRef[];
  strongAreas: ConceptRef[];
  /** Concepts whose mastery crossed the "mastered" line since last snapshot. */
  masteredRecently: ConceptRef[];
  /** Adaptive engine's single best next move, if available. */
  recommendation: {
    conceptId?: string | null;
    conceptName?: string | null;
    nextAction?: string | null;
    reason?: string | null;
    forgettingRisk?: string | null;
  } | null;
  /** Spaced-repetition items due for review. */
  revisionDue: ConceptRef[];
  streakDays: number;
  daysSinceActive: number | null;
  /** Minutes elapsed in the current continuous session. */
  sessionMinutes: number;
}

export interface ConceptRef {
  conceptId: string;
  name: string;
  /** 0..1 */
  mastery?: number;
  reason?: string;
}

/** Subtle, Duolingo-inspired progression derived entirely from real activity. */
export interface GamificationState {
  xp: number;
  level: number;
  levelLabel: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressToNext: number; // 0..1
  streakDays: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  label: string;
  icon: string;
  unlocked: boolean;
  hint?: string;
}
