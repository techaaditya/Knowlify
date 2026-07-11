/**
 * Full-screen Quiz Arena state.
 *
 * The companion launches this (from a "Quiz me" / "Challenge me" action) to take
 * over the screen with a focused, one-question-at-a-time quiz backed by the real
 * `generateWorkspaceQuiz` / `answerGeneratedQuiz` endpoints. Kept as its own tiny
 * store so any surface (companion, a page, a nudge) can start a quiz.
 */
import { create } from 'zustand';

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';
export type QuizMode = 'mixed' | 'mcq' | 'short_answer';

export interface QuizLaunchOptions {
  conceptId?: string | null;
  conceptName?: string | null;
  difficulty?: QuizDifficulty;
  questionMode?: QuizMode;
  /** Skip the setup screen and generate immediately. */
  autoStart?: boolean;
}

interface QuizArenaState {
  open: boolean;
  conceptId: string | null;
  conceptName: string | null;
  difficulty: QuizDifficulty;
  questionMode: QuizMode;
  autoStart: boolean;
  /** Increments each launch so the arena remounts fresh. */
  sessionKey: number;
  launch: (opts?: QuizLaunchOptions) => void;
  close: () => void;
}

export const useQuizArenaStore = create<QuizArenaState>((set) => ({
  open: false,
  conceptId: null,
  conceptName: null,
  difficulty: 'Medium',
  questionMode: 'mixed',
  autoStart: false,
  sessionKey: 0,

  launch: (opts = {}) =>
    set((s) => ({
      open: true,
      conceptId: opts.conceptId ?? null,
      conceptName: opts.conceptName ?? null,
      difficulty: opts.difficulty ?? 'Medium',
      questionMode: opts.questionMode ?? 'mixed',
      autoStart: opts.autoStart ?? Boolean(opts.conceptId),
      sessionKey: s.sessionKey + 1,
    })),

  close: () => set({ open: false }),
}));
