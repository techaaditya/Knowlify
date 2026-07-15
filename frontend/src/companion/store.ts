/**
 * Companion UI state. Kept separate from the brain so the brain stays pure and
 * the store only orchestrates: what mood is showing, which nudge is floating,
 * the chat thread, and derived gamification.
 */
import { create } from 'zustand';
import type {
  CompanionChatMessage,
  CompanionEmotion,
  CompanionNudge,
  GamificationState,
  LearningSnapshot,
} from './types';
import { uid } from './brain';

/** Transient emotions auto-revert to the data-derived baseline after a beat. */
let revertTimer: ReturnType<typeof setTimeout> | null = null;

interface CompanionState {
  // Panel
  isOpen: boolean;
  hasGreeted: boolean;
  unread: number;

  // Emotion
  emotion: CompanionEmotion;
  baselineEmotion: CompanionEmotion;

  // Conversation
  messages: CompanionChatMessage[];
  sending: boolean;

  // Proactive layer
  activeNudge: CompanionNudge | null;
  dismissedKinds: Set<string>;

  // Progress + data
  gamification: GamificationState | null;
  snapshot: LearningSnapshot | null;
  /** Bumps to trigger a one-shot celebration burst on the avatar. */
  celebrationToken: number;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  markGreeted: () => void;

  setBaselineEmotion: (e: CompanionEmotion) => void;
  /** Set the mood now; if `revertMs` is given, fall back to baseline after it. */
  setEmotion: (e: CompanionEmotion, revertMs?: number) => void;

  addMessage: (msg: CompanionChatMessage) => void;
  updateMessage: (id: string, patch: Partial<CompanionChatMessage>) => void;
  setSending: (v: boolean) => void;
  clearThread: () => void;

  showNudge: (nudge: CompanionNudge) => void;
  dismissNudge: (opts?: { remember?: boolean }) => void;

  setGamification: (g: GamificationState) => void;
  setSnapshot: (s: LearningSnapshot) => void;
  celebrate: () => void;
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  isOpen: false,
  hasGreeted: false,
  unread: 0,

  emotion: 'idle',
  baselineEmotion: 'idle',

  messages: [],
  sending: false,

  activeNudge: null,
  dismissedKinds: new Set<string>(),

  gamification: null,
  snapshot: null,
  celebrationToken: 0,

  open: () => set({ isOpen: true, unread: 0, activeNudge: null }),
  close: () => set({ isOpen: false }),
  toggle: () => (get().isOpen ? get().close() : get().open()),
  markGreeted: () => set({ hasGreeted: true }),

  setBaselineEmotion: (e) =>
    set((s) => ({
      baselineEmotion: e,
      // Only follow the baseline live when no transient emotion is pending.
      emotion: revertTimer ? s.emotion : e,
    })),

  setEmotion: (e, revertMs) => {
    if (revertTimer) {
      clearTimeout(revertTimer);
      revertTimer = null;
    }
    set({ emotion: e });
    if (revertMs && revertMs > 0) {
      revertTimer = setTimeout(() => {
        revertTimer = null;
        set((s) => ({ emotion: s.baselineEmotion }));
      }, revertMs);
    }
  },

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg],
      unread: s.isOpen || msg.role === 'user' ? s.unread : s.unread + 1,
    })),

  updateMessage: (id, patch) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

  setSending: (v) => set({ sending: v }),
  clearThread: () => set({ messages: [], hasGreeted: false }),

  showNudge: (nudge) => {
    const s = get();
    if (s.isOpen) return; // never interrupt an open conversation
    if (s.dismissedKinds.has(nudge.kind) && !nudge.sticky) return;
    if (s.activeNudge?.kind === nudge.kind) return;
    set({ activeNudge: nudge });
  },

  dismissNudge: (opts) =>
    set((s) => {
      const dismissed = new Set(s.dismissedKinds);
      if (s.activeNudge) dismissed.add(s.activeNudge.kind); // don't re-show this session
      if (opts?.remember && s.activeNudge) dismissed.add(s.activeNudge.kind);
      return { activeNudge: null, dismissedKinds: dismissed };
    }),

  setGamification: (g) => set({ gamification: g }),
  setSnapshot: (s) => set({ snapshot: s }),
  celebrate: () => set((s) => ({ celebrationToken: s.celebrationToken + 1 })),
}));

export const makeMessage = (
  role: CompanionChatMessage['role'],
  content: string,
  extra: Partial<CompanionChatMessage> = {},
): CompanionChatMessage => ({
  id: uid('m'),
  role,
  content,
  createdAt: Date.now(),
  ...extra,
});
