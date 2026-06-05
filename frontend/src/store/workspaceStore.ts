import { create } from 'zustand';
import {
  Workspace,
  WorkspaceDashboard,
  getWorkspaces,
  getWorkspaceDashboard,
  getWorkspaceGraph,
} from '../api/sources';

interface WorkspaceState {
  workspace: Workspace | null;
  dashboard: WorkspaceDashboard | null;
  graphData: { nodes: unknown[]; edges: unknown[] } | null;
  loading: boolean;
  error: string | null;
  fetchWorkspace: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  fetchGraph: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  dashboard: null,
  graphData: null,
  loading: false,
  error: null,

  fetchWorkspace: async () => {
    set({ loading: true, error: null });
    try {
      const workspaces = await getWorkspaces();
      const ws = workspaces[0] || null;
      set({ workspace: ws, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load workspace';
      set({ error: message, loading: false });
    }
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
