/**
 * AI Canvas teaching session — requests scenes from the real tutor endpoint
 * (`POST /api/chat` with `mode: 'canvas'`), tracks progressive playback
 * through the current scene's steps, and remembers every scene taught this
 * session (so "explain this again" continues rather than restarting, and so
 * a real end-of-session summary can be built from what actually happened).
 */
import { create } from 'zustand';
import client from '../../api/client';
import { useSourcesStore } from '../../store/sourcesStore';
import { useUserStore } from '../../store/userStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { CanvasHistoryEntry, CanvasScene } from './canvasTypes';

interface RawCanvasReply {
  reply: string;
  concept_name?: string | null;
  misconceptions?: string[];
  canvas_scene?: CanvasScene | null;
}

let uidCounter = 0;
const uid = (p = 'cv'): string => `${p}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;

interface CanvasSessionState {
  loading: boolean;
  error: string | null;
  fallbackText: string | null;

  scene: CanvasScene | null;
  stepIndex: number;
  playing: boolean;

  history: CanvasHistoryEntry[];
  sessionStartedAt: number;

  requestScene: (prompt: string, opts?: { conceptId?: string | null; conceptName?: string | null }) => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (i: number) => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  resetSession: () => void;
}

// Outgoing conversational memory for the canvas's own conversation — kept
// module-level (not component state) so it survives across renders and any
// component that triggers a request shares the same continuity.
let chatHistory: Array<{ role: string; content: string }> = [];
let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

const clearAutoAdvance = () => {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
};

export const useCanvasSessionStore = create<CanvasSessionState>((set, get) => ({
  loading: false,
  error: null,
  fallbackText: null,

  scene: null,
  stepIndex: 0,
  playing: false,

  history: [],
  sessionStartedAt: Date.now(),

  requestScene: async (prompt, opts) => {
    clearAutoAdvance();
    set({ loading: true, error: null, playing: false });

    const workspaceId = useWorkspaceStore.getState().workspace?.id;
    const studentId = useUserStore.getState().studentId;
    const selectedSourceIds = useSourcesStore.getState().selectedSourceIds;

    try {
      chatHistory = chatHistory.slice(-16);
      const res = await client.post<RawCanvasReply>('/api/chat', {
        workspace_id: workspaceId,
        concept_id: opts?.conceptId ?? null,
        student_id: studentId,
        mode: 'canvas',
        message: prompt,
        history: chatHistory,
        source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
      });

      const { reply, canvas_scene, misconceptions } = res.data;
      chatHistory.push({ role: 'user', content: prompt });
      chatHistory.push({ role: 'assistant', content: reply });

      if (canvas_scene && Array.isArray(canvas_scene.steps) && canvas_scene.steps.length > 0) {
        const entry: CanvasHistoryEntry = {
          id: uid('scene'),
          conceptId: opts?.conceptId ?? null,
          prompt,
          scene: canvas_scene,
          misconceptions: misconceptions ?? [],
          createdAt: Date.now(),
        };
        set((s) => ({
          scene: canvas_scene,
          stepIndex: 0,
          loading: false,
          fallbackText: null,
          history: [...s.history, entry],
        }));
      } else {
        // The model didn't return parseable scene JSON — degrade gracefully
        // to showing its plain-text reply rather than a blank canvas.
        set({ scene: null, fallbackText: reply, loading: false });
      }
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not reach the tutor to build this canvas. Please try again.';
      set({ error: detail, loading: false });
    }
  },

  nextStep: () => {
    const { scene, stepIndex } = get();
    if (!scene) return;
    if (stepIndex + 1 >= scene.steps.length) {
      set({ playing: false });
      clearAutoAdvance();
      return;
    }
    set({ stepIndex: stepIndex + 1 });
  },

  prevStep: () => {
    const { stepIndex } = get();
    if (stepIndex <= 0) return;
    set({ stepIndex: stepIndex - 1 });
  },

  goToStep: (i) => {
    const { scene } = get();
    if (!scene) return;
    set({ stepIndex: Math.max(0, Math.min(i, scene.steps.length - 1)) });
  },

  togglePlay: () => get().setPlaying(!get().playing),

  setPlaying: (v) => {
    clearAutoAdvance();
    set({ playing: v });
    if (v) {
      const tick = () => {
        const { scene, stepIndex, playing } = get();
        if (!playing || !scene) return;
        if (stepIndex + 1 >= scene.steps.length) {
          set({ playing: false });
          return;
        }
        set({ stepIndex: stepIndex + 1 });
        autoAdvanceTimer = setTimeout(tick, 3200);
      };
      autoAdvanceTimer = setTimeout(tick, 3200);
    }
  },

  resetSession: () => {
    clearAutoAdvance();
    chatHistory = [];
    set({
      scene: null,
      stepIndex: 0,
      playing: false,
      fallbackText: null,
      error: null,
      history: [],
      sessionStartedAt: Date.now(),
    });
  },
}));
