/**
 * AI Canvas teaching session — requests scenes from the real tutor endpoint
 * (`POST /api/chat` with `mode: 'canvas'`), tracks progressive playback
 * through the current scene's steps, remembers every scene taught this session
 * (so "explain this again" continues rather than restarting, and a real
 * end-of-session summary can be built), and holds the interactive editing state
 * (selection, inline edits, undo/redo, persisted node positions).
 */
import { create } from 'zustand';
import client from '../../api/client';
import { useSourcesStore } from '../../store/sourcesStore';
import { useUserStore } from '../../store/userStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  normalizeScene,
  type CanvasHistoryEntry,
  type CanvasScene,
  type CanvasSelection,
  type CanvasStep,
} from './canvasTypes';

interface RawCanvasReply {
  reply: string;
  concept_name?: string | null;
  misconceptions?: string[];
  canvas_scene?: unknown;
}

let uidCounter = 0;
const uid = (p = 'cv'): string => `${p}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;

const cloneScene = (scene: CanvasScene): CanvasScene => JSON.parse(JSON.stringify(scene));

interface NodePosition {
  x: number;
  y: number;
}

interface RequestOpts {
  conceptId?: string | null;
  conceptName?: string | null;
  canvasType?: string | null;
}

interface CanvasSessionState {
  loading: boolean;
  error: string | null;
  fallbackText: string | null;

  scene: CanvasScene | null;
  stepIndex: number;
  playing: boolean;
  playbackSpeed: number;

  // Interactive editing.
  selection: CanvasSelection;
  nodePositions: Record<string, NodePosition>;
  past: CanvasScene[];
  future: CanvasScene[];

  history: CanvasHistoryEntry[];
  sessionStartedAt: number;

  requestScene: (prompt: string, opts?: RequestOpts) => Promise<void>;
  loadScene: (scene: CanvasScene, opts?: { prompt?: string; conceptId?: string | null }) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (i: number) => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  setPlaybackSpeed: (v: number) => void;
  resetSession: () => void;

  select: (sel: CanvasSelection) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  updateNarration: (text: string) => void;
  updateNode: (id: string, fields: { label?: string; note?: string }) => void;
  updateChartPoint: (index: number, fields: { label?: string; value?: number }) => void;
  updateTimelineEvent: (index: number, fields: { label?: string; detail?: string }) => void;
  updateComparisonRow: (index: number, fields: { label?: string; values?: string[] }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// Outgoing conversational memory for the canvas's own conversation — kept
// module-level (not component state) so it survives across renders and any
// component that triggers a request shares the same continuity.
let chatHistory: Array<{ role: string; content: string }> = [];
let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
const BASE_STEP_MS = 3200;

const clearAutoAdvance = () => {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
};

export const useCanvasSessionStore = create<CanvasSessionState>((set, get) => {
  /** Push the current scene onto the undo stack and commit an edited copy. */
  const commitScene = (next: CanvasScene) => {
    const current = get().scene;
    set((s) => ({
      scene: next,
      past: current ? [...s.past, current].slice(-50) : s.past,
      future: [],
    }));
  };

  /** Edit the payload of every step that carries the active visualization. */
  const patchAllSteps = (fn: (payload: any) => void) => {
    const scene = get().scene;
    if (!scene) return;
    const next = cloneScene(scene);
    const key = next.visualization;
    next.steps.forEach((step: CanvasStep) => {
      const payload = (step as any)[key];
      if (payload) fn(payload);
    });
    commitScene(next);
  };

  return {
    loading: false,
    error: null,
    fallbackText: null,

    scene: null,
    stepIndex: 0,
    playing: false,
    playbackSpeed: 1,

    selection: null,
    nodePositions: {},
    past: [],
    future: [],

    history: [],
    sessionStartedAt: Date.now(),

    requestScene: async (prompt, opts) => {
      clearAutoAdvance();
      set({ loading: true, error: null, playing: false, selection: null });

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
          canvas_type: opts?.canvasType ?? undefined,
        });

        const { reply, canvas_scene, misconceptions, concept_name } = res.data;
        chatHistory.push({ role: 'user', content: prompt });
        chatHistory.push({ role: 'assistant', content: reply });

        const scene = normalizeScene(canvas_scene);
        if (scene) {
          if (!scene.title || scene.title === 'Concept') {
            scene.title = concept_name || opts?.conceptName || scene.title;
          }
          const entry: CanvasHistoryEntry = {
            id: uid('scene'),
            conceptId: opts?.conceptId ?? null,
            prompt,
            scene,
            misconceptions: misconceptions ?? [],
            createdAt: Date.now(),
          };
          set((s) => ({
            scene,
            stepIndex: 0,
            loading: false,
            fallbackText: null,
            selection: null,
            nodePositions: {},
            past: [],
            future: [],
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

    loadScene: (scene, opts) => {
      clearAutoAdvance();
      const normalized = normalizeScene(scene) ?? scene;
      const entry: CanvasHistoryEntry = {
        id: uid('scene'),
        conceptId: opts?.conceptId ?? null,
        prompt: opts?.prompt ?? normalized.title,
        scene: normalized,
        misconceptions: [],
        createdAt: Date.now(),
      };
      set((s) => ({
        scene: normalized,
        stepIndex: 0,
        loading: false,
        error: null,
        fallbackText: null,
        playing: false,
        selection: null,
        nodePositions: {},
        past: [],
        future: [],
        history: [...s.history, entry],
      }));
    },

    nextStep: () => {
      const { scene, stepIndex } = get();
      if (!scene) return;
      if (stepIndex + 1 >= scene.steps.length) {
        set({ playing: false });
        clearAutoAdvance();
        return;
      }
      set({ stepIndex: stepIndex + 1, selection: null });
    },

    prevStep: () => {
      const { stepIndex } = get();
      if (stepIndex <= 0) return;
      set({ stepIndex: stepIndex - 1, selection: null });
    },

    goToStep: (i) => {
      const { scene } = get();
      if (!scene) return;
      set({ stepIndex: Math.max(0, Math.min(i, scene.steps.length - 1)), selection: null });
    },

    togglePlay: () => get().setPlaying(!get().playing),

    setPlaying: (v) => {
      clearAutoAdvance();
      set({ playing: v });
      if (v) {
        const tick = () => {
          const { scene, stepIndex, playing, playbackSpeed } = get();
          if (!playing || !scene) return;
          if (stepIndex + 1 >= scene.steps.length) {
            set({ playing: false });
            return;
          }
          set({ stepIndex: stepIndex + 1 });
          autoAdvanceTimer = setTimeout(tick, BASE_STEP_MS / playbackSpeed);
        };
        autoAdvanceTimer = setTimeout(tick, BASE_STEP_MS / get().playbackSpeed);
      }
    },

    setPlaybackSpeed: (v) => {
      set({ playbackSpeed: v });
      // Re-arm the timer at the new cadence if currently playing.
      if (get().playing) get().setPlaying(true);
    },

    resetSession: () => {
      clearAutoAdvance();
      chatHistory = [];
      set({
        scene: null,
        stepIndex: 0,
        playing: false,
        playbackSpeed: 1,
        fallbackText: null,
        error: null,
        selection: null,
        nodePositions: {},
        past: [],
        future: [],
        history: [],
        sessionStartedAt: Date.now(),
      });
    },

    select: (sel) => set({ selection: sel }),

    setNodePosition: (id, x, y) =>
      set((s) => ({ nodePositions: { ...s.nodePositions, [id]: { x, y } } })),

    updateNarration: (text) => {
      const scene = get().scene;
      if (!scene) return;
      const idx = get().stepIndex;
      const next = cloneScene(scene);
      if (next.steps[idx]) next.steps[idx].narration = text;
      commitScene(next);
    },

    updateNode: (id, fields) =>
      patchAllSteps((payload) => {
        const nodes = payload.nodes as Array<{ id: string; label?: string; note?: string }> | undefined;
        const node = nodes?.find((n) => n.id === id);
        if (node) {
          if (fields.label !== undefined) node.label = fields.label;
          if (fields.note !== undefined) node.note = fields.note;
        }
      }),

    updateChartPoint: (index, fields) =>
      patchAllSteps((payload) => {
        const pt = payload.points?.[index];
        if (pt) {
          if (fields.label !== undefined) pt.label = fields.label;
          if (fields.value !== undefined) pt.value = fields.value;
        }
      }),

    updateTimelineEvent: (index, fields) =>
      patchAllSteps((payload) => {
        const ev = payload.events?.[index];
        if (ev) {
          if (fields.label !== undefined) ev.label = fields.label;
          if (fields.detail !== undefined) ev.detail = fields.detail;
        }
      }),

    updateComparisonRow: (index, fields) =>
      patchAllSteps((payload) => {
        const row = payload.rows?.[index];
        if (row) {
          if (fields.label !== undefined) row.label = fields.label;
          if (fields.values !== undefined) row.values = fields.values;
        }
      }),

    undo: () => {
      const { past, scene } = get();
      if (past.length === 0 || !scene) return;
      const prev = past[past.length - 1];
      set((s) => ({
        scene: prev,
        past: s.past.slice(0, -1),
        future: [scene, ...s.future].slice(0, 50),
        stepIndex: Math.min(s.stepIndex, prev.steps.length - 1),
      }));
    },

    redo: () => {
      const { future, scene } = get();
      if (future.length === 0 || !scene) return;
      const nextScene = future[0];
      set((s) => ({
        scene: nextScene,
        future: s.future.slice(1),
        past: [...s.past, scene].slice(-50),
        stepIndex: Math.min(s.stepIndex, nextScene.steps.length - 1),
      }));
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});
