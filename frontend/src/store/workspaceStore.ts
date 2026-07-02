import { create } from 'zustand';
import {
  Workspace,
  WorkspaceDashboard,
  getWorkspaces,
  getWorkspaceDashboard,
  getWorkspaceGraph,
  createWorkspace,
} from '../api/sources';

interface WorkspaceState {
  workspace: Workspace | null;
  workspaces: Workspace[];
  dashboard: WorkspaceDashboard | null;
  graphData: { nodes: unknown[]; edges: unknown[] } | null;
  loading: boolean;
  error: string | null;
  fetchWorkspace: () => Promise<void>;
  setWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string) => Promise<void>;
  fetchDashboard: () => Promise<void>;
  fetchGraph: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  workspaces: [],
  dashboard: null,
  graphData: null,
  loading: false,
  error: null,

  fetchWorkspace: async () => {
    set({ loading: true, error: null });
    try {
      const workspaces = await getWorkspaces();
      const ws = workspaces[0] || null;
      const currentId = get().workspace?.id;
      set({ workspace: workspaces.find((item) => item.id === currentId) || ws, workspaces, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load workspace';
      set({ error: message, loading: false });
    }
  },

  setWorkspace: (workspaceId) => {
    const workspace = get().workspaces.find((item) => item.id === workspaceId) || null;
    set({ workspace, dashboard: null, graphData: null });
  },

  createWorkspace: async (name) => {
    const workspace = await createWorkspace(name);
    set((state) => ({ workspace, workspaces: [workspace, ...state.workspaces] }));
  },

  fetchDashboard: async () => {
    const ws = get().workspace;
    if (!ws) return;
    try {
      const dashboard = await getWorkspaceDashboard(ws.id);
      set({ dashboard });
    } catch {
      /* dashboard optional */
    }
  },

  fetchGraph: async () => {
    const ws = get().workspace;
    if (!ws) return;
    try {
      const graphData = await getWorkspaceGraph(ws.id);
      set({ graphData });
    } catch {
      set({ graphData: { nodes: [], edges: [] } });
    }
  },

  refreshAll: async () => {
    await get().fetchWorkspace();
    await Promise.all([get().fetchDashboard(), get().fetchGraph()]);
  },
}));
