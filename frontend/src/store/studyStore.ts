import { create } from 'zustand';
import { getWorkspaceGraph } from '../api/sources';
import { useSourcesStore } from './sourcesStore';

export interface GraphNode {
  id: string;
  display_name: string;
  description: string;
  difficulty: number;
  prerequisites: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface StudyState {
  currentCourse: string;
  graphData: GraphData | null;
  selectedNodeId: string | null;
  selectedNodeData: GraphNode | null;
  loading: boolean;
  error: string | null;
  setCourse: (course: string) => void;
  fetchGraphData: (course?: string, workspaceId?: string) => Promise<void>;
  setSelectedNodeId: (nodeId: string | null) => void;
  runExtractionPipeline: () => Promise<GraphData>;
}

export const useStudyStore = create<StudyState>((set, get) => ({
  currentCourse: 'Workspace',
  graphData: null,
  selectedNodeId: null,
  selectedNodeData: null,
  loading: false,
  error: null,
  setCourse: (course) => {
    set({ currentCourse: course, selectedNodeId: null, selectedNodeData: null });
  },
  fetchGraphData: async (course, workspaceId) => {
    const activeCourse = course || get().currentCourse;
    set({ loading: true, error: null });
    try {
      if (activeCourse === 'Workspace' && workspaceId) {
        const selectedIds = useSourcesStore.getState().selectedSourceIds;
        const graphData = await getWorkspaceGraph(
          workspaceId,
          selectedIds.length > 0 ? selectedIds : undefined
        );
        set({ graphData, loading: false });
        return;
      }
      set({ graphData: { nodes: [], edges: [] }, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  setSelectedNodeId: (nodeId) => {
    const graph = get().graphData;
    const node = graph?.nodes.find((n) => n.id === nodeId) || null;
    set({ selectedNodeId: nodeId, selectedNodeData: node });
  },
  runExtractionPipeline: async () => {
    set({ loading: true });
    try {
      throw new Error('Upload a source to a workspace to create a knowledge graph.');
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
