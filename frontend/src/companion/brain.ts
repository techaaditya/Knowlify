/**
 * The Companion "brain" — pure, side-effect-free logic that turns a
 * {@link LearningSnapshot} into what the mentor should feel, say, and suggest.
 *
 * Keeping this pure means the personality is deterministic, easy to tune, and
 * unit-testable in isolation from React, the network, and the avatar.
 */
import type {
  Achievement,
  CompanionAction,
  CompanionEmotion,
  CompanionNudge,
  ConceptRef,
  GamificationState,
  LearningSnapshot,
} from './types';

let counter = 0;
export const uid = (p = 'c'): string => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/** Mastery thresholds shared by the companion's reactions. */
export const MASTERED = 0.8;
export const WEAK = 0.4;

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Normalise a mastery value that may arrive as 0..1 or 0..100. */
export const norm01 = (v: number | null | undefined): number => {
  if (v == null || Number.isNaN(v)) return 0;
  return clamp01(v > 1 ? v / 100 : v);
};

export const pct = (v: number): number => Math.round(norm01(v) * 100);

// ── Action factory ──────────────────────────────────────────────────────────
// Central place that maps an intent to a labelled chip + the tutor prompt/mode
// it should run. Nothing here is user-visible copy that's hardcoded per-concept;
// concept names are always injected from live data.

type ActionSpec = Omit<CompanionAction, 'id'>;

export const action = (spec: ActionSpec): CompanionAction => ({ id: uid('a'), ...spec });

export const explainAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'explain_again',
    label: c ? `Explain ${c.name} again` : 'Explain this again',
    icon: '💡',
    mode: 'explain',
    conceptId: c?.conceptId,
    prompt: c ? `Explain ${c.name} to me simply, as if I'm seeing it for the first time.` : 'Explain this concept simply.',
  });

export const visualAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'visual_explanation',
    label: 'Show it visually',
    icon: '🎨',
    mode: 'explain',
    conceptId: c?.conceptId,
    prompt: c ? `Give me a visual, intuitive explanation of ${c.name} with an analogy or diagram in words.` : 'Explain this visually with an analogy.',
  });

export const quizAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'take_quiz',
    label: c ? `Quiz me on ${c.name}` : 'Quiz me',
    icon: '🎯',
    mode: 'test',
    conceptId: c?.conceptId,
    prompt: c ? `Give me a practice quiz question about ${c.name}.` : 'Give me a practice quiz question.',
  });

export const challengeAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'challenge',
    label: 'Challenge me',
    icon: '🔥',
    mode: 'test',
    conceptId: c?.conceptId,
    prompt: c ? `I feel confident — give me a harder challenge question on ${c.name}.` : 'Give me a challenging question.',
  });

export const practiceAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'practice',
    label: 'Practice questions',
    icon: '✏️',
    mode: 'example',
    conceptId: c?.conceptId,
    prompt: c ? `Walk me through a worked example for ${c.name}, then let me try one.` : 'Give me a worked example to practice.',
  });

export const summaryAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'generate_summary',
    label: 'Summarize for me',
    icon: '📝',
    mode: 'explain',
    conceptId: c?.conceptId,
    prompt: c ? `Give me a concise summary of the key points of ${c.name}.` : 'Summarize the key points for me.',
  });

export const mistakesAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'show_mistakes',
    label: 'Review my mistakes',
    icon: '🔍',
    mode: 'socratic',
    conceptId: c?.conceptId,
    prompt: c
      ? `I've been making mistakes on ${c.name}. Help me find the misconception and correct it.`
      : 'Help me understand the mistakes I keep making.',
  });

export const reviewWeakAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'review_weak',
    label: c ? `Review ${c.name}` : 'Review weak topics',
    icon: '🩹',
    mode: 'step_by_step',
    conceptId: c?.conceptId,
    prompt: c ? `Let's carefully review ${c.name} step by step — I'm struggling with it.` : "Let's review the topics I'm weakest on.",
  });

export const nextLessonAction = (c?: ConceptRef | null): CompanionAction =>
  action({
    intent: 'next_lesson',
    label: c ? `Start ${c.name}` : 'Next lesson',
    icon: '➡️',
    mode: 'step_by_step',
    conceptId: c?.conceptId,
    prompt: c ? `I'm ready for ${c.name}. Teach it to me step by step.` : "What should I learn next? Teach me.",
  });

export const tipsAction = (): CompanionAction =>
  action({
    intent: 'learning_tips',
    label: 'Give me a study tip',
    icon: '🧭',
    mode: 'explain',
    prompt: 'Give me one concrete, science-backed study tip tailored to how I have been learning.',
  });

// ── Gamification ─────────────────────────────────────────────────────────────
// XP is derived from *real* activity, never fabricated: attempts, correct
// answers, and mastered concepts. Levels use a gentle quadratic curve.

const LEVEL_TITLES = [
  'Newcomer', 'Explorer', 'Learner', 'Apprentice', 'Scholar',
  'Adept', 'Strategist', 'Expert', 'Mentor', 'Luminary', 'Sage',
];

export const xpForLevel = (level: number): number => 100 * level * level; // cumulative xp needed to *reach* `level`

export const deriveGamification = (snap: LearningSnapshot, masteredCount: number): GamificationState => {
  const xp = Math.round(
    snap.totalAttempts * 12 +
      Math.round(snap.accuracy * snap.totalAttempts) * 8 +
      masteredCount * 120 +
      snap.streakDays * 20,
  );

  let level = 1;
  while (xp >= xpForLevel(level + 1) && level < 99) level += 1;

  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progressToNext = clamp01((xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp));

  return {
    xp,
    level,
    levelLabel: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    currentLevelXp,
    nextLevelXp,
    progressToNext,
    streakDays: snap.streakDays,
    achievements: deriveAchievements(snap, masteredCount),
  };
};

const deriveAchievements = (snap: LearningSnapshot, masteredCount: number): Achievement[] => [
  { id: 'first-steps', label: 'First Steps', icon: '🌱', unlocked: snap.totalAttempts >= 1, hint: 'Answer your first question' },
  { id: 'streak-3', label: '3-Day Streak', icon: '🔥', unlocked: snap.streakDays >= 3, hint: 'Study 3 days in a row' },
  { id: 'streak-7', label: 'Week Warrior', icon: '⚡', unlocked: snap.streakDays >= 7, hint: 'Study 7 days in a row' },
  { id: 'first-mastery', label: 'Concept Master', icon: '🏅', unlocked: masteredCount >= 1, hint: 'Master your first concept' },
  { id: 'five-mastery', label: 'Rising Scholar', icon: '🎓', unlocked: masteredCount >= 5, hint: 'Master 5 concepts' },
  { id: 'sharpshooter', label: 'Sharpshooter', icon: '🎯', unlocked: snap.totalAttempts >= 10 && snap.accuracy >= 0.85, hint: '85%+ accuracy over 10 attempts' },
];

// ── Resting emotion ──────────────────────────────────────────────────────────
// The *baseline* mood inferred from the learner's overall state. Transient
// event emotions (a correct answer, a failed quiz) are layered on top of this
// by the store and revert back to this baseline.

export const deriveBaselineEmotion = (snap: LearningSnapshot): CompanionEmotion => {
  if (!snap.hasData) return 'curious';
  if (snap.daysSinceActive != null && snap.daysSinceActive >= 3) return 'waiting';
  if (snap.misconceptionCount >= 3 || snap.weakAreas.length >= 3) return 'concerned';
  if (snap.averageMastery >= MASTERED && snap.topicsStarted >= 3) return 'confident';
  if (snap.averageMastery >= 0.55) return 'happy';
  return 'idle';
};

// ── Proactive nudges ─────────────────────────────────────────────────────────
// Ordered by priority; the provider surfaces the highest-priority eligible one
// that hasn't already been dismissed this session.

export const deriveNudges = (snap: LearningSnapshot): CompanionNudge[] => {
  const nudges: CompanionNudge[] = [];
  const name = firstName(snap.studentName);

  if (!snap.hasData) {
    nudges.push({
      id: uid('n'), kind: 'onboarding', emotion: 'curious', priority: 100, sticky: true,
      text: name ? `Hi ${name}! I'm your learning companion. Add a source and I'll build your first knowledge map.` : `Hi! I'm your learning companion. Add a source and I'll help you master it.`,
      actions: [action({ intent: 'ask', label: 'How does this work?', icon: '👋', prompt: 'How does Knowlify work? What can you help me with?' })],
    });
    return nudges;
  }

  // Welcome back after an absence.
  if (snap.daysSinceActive != null && snap.daysSinceActive >= 3) {
    const target = snap.revisionDue[0] || snap.weakAreas[0];
    nudges.push({
      id: uid('n'), kind: 'welcome_back', emotion: 'waiting', priority: 95, sticky: true,
      text: name ? `Welcome back, ${name}! It's been ${snap.daysSinceActive} days — shall we pick up where you left off?` : `Welcome back! Shall we continue where you left off?`,
      actions: target ? [reviewWeakAction(target), tipsAction()] : [tipsAction()],
    });
  }

  // Long study session — gently suggest a break.
  if (snap.sessionMinutes >= 45) {
    nudges.push({
      id: uid('n'), kind: 'take_break', emotion: 'concerned', priority: 70,
      text: `You've been focused for ${Math.round(snap.sessionMinutes)} minutes. A short break helps memory consolidate — I'll be right here.`,
    });
  }

  // Spaced-repetition due.
  if (snap.revisionDue.length > 0) {
    const c = snap.revisionDue[0];
    nudges.push({
      id: uid('n'), kind: 'revision_due', emotion: 'thinking', priority: 68,
      text: `${c.name} is fading from memory — a quick review now will lock it in.`,
      actions: [reviewWeakAction(c), quizAction(c)],
    });
  }

  // Struggling with a specific concept.
  if (snap.weakAreas.length > 0) {
    const c = snap.weakAreas[0];
    nudges.push({
      id: uid('n'), kind: `weak_${c.conceptId}`, emotion: 'concerned', priority: 66,
      text: `I noticed ${c.name} is giving you trouble. Want me to explain it a different way?`,
      actions: [explainAction(c), visualAction(c), snap.misconceptionCount > 0 ? mistakesAction(c) : practiceAction(c)],
    });
  }

  // Ready for a harder challenge.
  if (snap.averageMastery >= MASTERED && snap.strongAreas.length > 0) {
    const c = snap.strongAreas[0];
    nudges.push({
      id: uid('n'), kind: 'ready_challenge', emotion: 'confident', priority: 60,
      text: `You're on top of ${c.name}. I think you're ready for a harder challenge.`,
      actions: [challengeAction(c), snap.recommendation?.conceptName ? nextLessonAction({ conceptId: snap.recommendation.conceptId || '', name: snap.recommendation.conceptName }) : quizAction(c)],
    });
  }

  // Adaptive engine recommendation (what to study next).
  if (snap.recommendation?.conceptName) {
    const c: ConceptRef = { conceptId: snap.recommendation.conceptId || '', name: snap.recommendation.conceptName };
    nudges.push({
      id: uid('n'), kind: 'recommendation', emotion: 'teaching', priority: 55,
      text: snap.recommendation.reason
        ? `Next up: ${c.name}. ${snap.recommendation.reason}`
        : `Based on your progress, ${c.name} is the best thing to tackle next.`,
      actions: [nextLessonAction(c), summaryAction(c)],
    });
  }

  // Nothing pressing — offer a gentle daily goal.
  nudges.push({
    id: uid('n'), kind: 'daily_goal', emotion: 'happy', priority: 20,
    text: name ? `Ready to learn, ${name}? Answer a few questions to keep your ${snap.streakDays}-day streak alive.` : `Ready to learn? A few questions a day keeps your streak alive.`,
    actions: [snap.weakAreas[0] ? quizAction(snap.weakAreas[0]) : quizAction(), tipsAction()],
  });

  return nudges.sort((a, b) => b.priority - a.priority);
};

// ── Greeting (first open of a session) ───────────────────────────────────────

export const buildGreeting = (snap: LearningSnapshot): { text: string; emotion: CompanionEmotion; actions: CompanionAction[] } => {
  const name = firstName(snap.studentName);
  const hi = timeGreeting();

  if (!snap.hasData) {
    return {
      emotion: 'curious',
      text: `${hi}${name ? `, ${name}` : ''}! 👋 I'm your AI learning companion. Import a source and I'll map out what to learn — then I'll coach you through every step. What are we studying today?`,
      actions: [action({ intent: 'ask', label: 'What can you do?', icon: '✨', prompt: 'What can you help me with?' })],
    };
  }

  const parts: string[] = [`${hi}${name ? `, ${name}` : ''}! 👋`];
  if (snap.masteredRecently.length > 0) {
    parts.push(`Great work mastering ${snap.masteredRecently.map((c) => c.name).slice(0, 2).join(' and ')} 🎉`);
  }
  parts.push(`You're at **${pct(snap.averageMastery)}% average mastery** across ${snap.topicsStarted} topics.`);
  if (snap.weakAreas[0]) {
    parts.push(`Today's goal: strengthen **${snap.weakAreas[0].name}**.`);
  } else if (snap.recommendation?.conceptName) {
    parts.push(`I'd suggest starting **${snap.recommendation.conceptName}** next.`);
  }

  const actions: CompanionAction[] = [];
  if (snap.weakAreas[0]) actions.push(reviewWeakAction(snap.weakAreas[0]));
  if (snap.recommendation?.conceptName) actions.push(nextLessonAction({ conceptId: snap.recommendation.conceptId || '', name: snap.recommendation.conceptName }));
  actions.push(snap.weakAreas[0] ? quizAction(snap.weakAreas[0]) : quizAction());

  return {
    emotion: snap.masteredRecently.length > 0 ? 'celebrating' : deriveBaselineEmotion(snap),
    text: parts.join(' '),
    actions: actions.slice(0, 3),
  };
};

// ── Contextual quick actions for the chat composer ───────────────────────────

export const composerActions = (snap: LearningSnapshot): CompanionAction[] => {
  const target = snap.weakAreas[0] || snap.strongAreas[0] || null;
  const list: CompanionAction[] = [];
  if (snap.recommendation?.conceptName) {
    list.push(nextLessonAction({ conceptId: snap.recommendation.conceptId || '', name: snap.recommendation.conceptName }));
  }
  list.push(explainAction(target), quizAction(target), summaryAction(target));
  if (snap.misconceptionCount > 0) list.push(mistakesAction(snap.weakAreas[0]));
  if (snap.averageMastery >= MASTERED) list.push(challengeAction(snap.strongAreas[0]));
  list.push(tipsAction());
  // De-dupe by intent+concept.
  const seen = new Set<string>();
  return list.filter((a) => {
    const key = `${a.intent}:${a.conceptId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
};

// ── Small helpers ────────────────────────────────────────────────────────────

export const firstName = (full: string): string => (full || '').trim().split(/\s+/)[0] || '';

const timeGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

/** Humanise a raw concept id like "linear_regression" → "Linear Regression". */
export const humanizeConcept = (raw: string): string =>
  (raw || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
