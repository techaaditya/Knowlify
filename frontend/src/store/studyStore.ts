import { create } from 'zustand';
import client from '../api/client';

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
  fetchGraphData: (course?: string) => Promise<void>;
  setSelectedNodeId: (nodeId: string | null) => void;
  runExtractionPipeline: () => Promise<GraphData>;
}

export const useStudyStore = create<StudyState>((set, get) => ({
  currentCourse: 'Calculus',
  graphData: null,
  selectedNodeId: null,
  selectedNodeData: null,
  loading: false,
  error: null,
  setCourse: (course) => {
    set({ currentCourse: course, selectedNodeId: null, selectedNodeData: null });
  },
  fetchGraphData: async (course) => {
    const activeCourse = course || get().currentCourse;
    set({ loading: true, error: null });
    try {
      const res = await client.get(`/api/graph?course=${activeCourse}`);
      set({ graphData: res.data, loading: false });
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
      const res = await client.post('/api/extract');
      set({ graphData: res.data, currentCourse: 'VoiceBanking', loading: false });
      return res.data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
