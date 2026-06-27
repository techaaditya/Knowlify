import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ADAPTIVE_API_KEY = import.meta.env.VITE_ADAPTIVE_API_KEY;

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;

export interface AdaptiveRecommendation {
  success: boolean;
  student_id: string;
  concept_id: string;
  concept_name: string;
  previous_mastery: number;
  current_mastery: number;
  forgetting_risk: string;
  next_action: string;
  recommended_concept: string | null;
  reason: string;
  misconception?: string | null;
  mastery_source?: string;
  readiness_score?: number | null;
  suggested_activity?: string | null;
  weakest_prerequisite?: string | null;
  prerequisite_source?: string | null;
}

export const getAdaptiveRecommendation = async (studentId: string, conceptId: string, workspaceId: string) => {
  const response = await client.get<AdaptiveRecommendation>(`/api/adaptive/recommendation/${studentId}`, {
    params: { concept_id: conceptId, workspace_id: workspaceId },
    headers: ADAPTIVE_API_KEY ? { 'X-Adaptive-API-Key': ADAPTIVE_API_KEY } : undefined,
  });
  return response.data;
};

export interface DashboardEngineSummary {
  summary: {
    student_id: string;
    student_name: string;
    average_mastery: number;
    accuracy_rate: number;
    total_attempts: number;
    topics_attempted: number;
    average_time_seconds: number;
    hint_dependency: number;
    misconception_count: number;
  };
  mastery_distribution: Record<string, number>;
  weak_areas: Array<{
    concept_id: string;
    mastery: number;
    status: string;
    error_count: number;
    hints_used: number;
    blocks: string[];
    priority_score: number;
    reason: string;
  }>;
  misconceptions: Array<{
    concept_id: string;
    error_type: string;
    count: number;
    severity: string;
  }>;
  learning_velocity: Array<{
    step: number;
    date: string;
    topic: string;
    cumulative_accuracy: number;
    topic_accuracy: number;
  }>;
  study_heatmap: Array<{
    date: string;
    attempts: number;
    intensity: number;
  }>;
  context_graph: {
    node_count: number;
    edge_count: number;
    covered_topics: number;
    bottlenecks: Array<{ concept_id: string; weak_prerequisites: string[] }>;
    source: string;
  };
  adaptive_recommendation: AdaptiveRecommendation | null;
  generative_suggestions: Array<{
    type: string;
    title: string;
    target_concept: string | null;
    reason: string;
  }>;
  engine_connections: string[];
}

export const getDashboardEngineSummary = async (studentId: string, workspaceId?: string) => {
  if (!workspaceId) {
    throw new Error('Select a workspace to view learning analytics.');
  }
  const response = await client.get<DashboardEngineSummary>(`/api/dashboard/student/${studentId}`, {
    params: { workspace_id: workspaceId },
  });
  return response.data;
};

export interface GeneratedQuizQuestion {
  id: string;
  concept_id: string;
  prompt: string;
  options: string[];
}

export interface GeneratedFlashcard {
  id: string;
  front: string;
  back: string;
}

export const generateWorkspaceQuiz = async (workspaceId: string, conceptId: string) => {
  const response = await client.post<{ concept_id: string; title: string; instructions: string; questions: GeneratedQuizQuestion[] }>('/api/quiz/generate', {
    workspace_id: workspaceId,
    concept_id: conceptId,
  });
  return response.data;
};

export const answerGeneratedQuiz = async (payload: {
  student_id: string;
  workspace_id: string;
  question_id: string;
  selected_option: number;
  hints_used: number;
  time_taken: number;
}) => {
  const response = await client.post<{
    success: boolean;
    student: unknown;
    is_correct: boolean;
    correct_answer: string;
    explanation: string;
    adaptive_recommendation?: AdaptiveRecommendation | null;
  }>('/api/quiz/answer', payload);
  return response.data;
};

export const getGeneratedFlashcards = async (workspaceId: string, conceptId: string, count = 4) => {
  const response = await client.get<{ concept_id: string; cards: GeneratedFlashcard[] }>('/api/flashcards', {
    params: { workspace_id: workspaceId, concept_id: conceptId, count },
  });
  return response.data;
};
