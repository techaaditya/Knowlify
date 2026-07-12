/**
 * Cross-app AI Canvas launcher — the same pattern as `quizArenaStore`.
 *
 * The AI Canvas lives as a normal tab (not an overlay), so "launching" it
 * from elsewhere in the app (Knowledge Graph side panel, a wrong quiz
 * answer, a companion recommendation) means: switch App.tsx to the canvas
 * tab AND hand it a concept/prompt to start teaching. App.tsx watches
 * `requestToken` and flips `activeTab` whenever a new launch comes in.
 */
import { create } from 'zustand';

export interface CanvasLaunchOptions {
  conceptId?: string | null;
  conceptName?: string | null;
  /** Free-form ask, e.g. "Explain why I got this wrong." Defaults to teaching the concept. */
  prompt?: string | null;
}

interface CanvasLaunchState {
  requestToken: number;
  conceptId: string | null;
  conceptName: string | null;
  prompt: string | null;
  launch: (opts?: CanvasLaunchOptions) => void;
}

export const useCanvasLaunchStore = create<CanvasLaunchState>((set) => ({
  requestToken: 0,
  conceptId: null,
  conceptName: null,
  prompt: null,
  launch: (opts = {}) =>
    set((s) => ({
      requestToken: s.requestToken + 1,
      conceptId: opts.conceptId ?? null,
      conceptName: opts.conceptName ?? null,
      prompt: opts.prompt ?? null,
    })),
}));
