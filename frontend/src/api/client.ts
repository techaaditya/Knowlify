import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ADAPTIVE_API_KEY = import.meta.env.VITE_ADAPTIVE_API_KEY;
const CHATBOT_API_KEY = import.meta.env.VITE_CHATBOT_API_KEY;

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  if (CHATBOT_API_KEY && config.url?.startsWith('/api/chat')) {
    config.headers['X-Chatbot-API-Key'] = CHATBOT_API_KEY;
  }
  return config;
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
  source_organization: {
    total_sources?: number;
    completed_sources?: number;
    processing_sources?: number;
    failed_sources?: number;
    total_chunks?: number;
    total_entities?: number;
    total_relationships?: number;
    workspace_count?: number;
    mode?: string;
    source_types?: Record<string, number>;
  };
  revision_plan: Array<{
    type: string;
    concept_id: string;
    card_id?: string;
    next_review_date: string;
    reason: string;
  }>;
  adaptive_recommendation: AdaptiveRecommendation | null;
  generative_suggestions: Array<{
    type: string;
    title: string;
    target_concept: string | null;
    reason: string;
  }>;
  engine_connections: string[];
}

export const getDashboardEngineSummary = async (studentId: string, workspaceId?: string, scope: 'workspace' | 'overall' = 'workspace') => {
  if (scope === 'workspace' && !workspaceId) {
    throw new Error('Select a workspace to view learning analytics.');
  }
  const response = await client.get<DashboardEngineSummary>(`/api/dashboard/student/${studentId}`, {
    params: { workspace_id: workspaceId, scope },
  });
  return response.data;
};

export interface GeneratedQuizQuestion {
  id: string;
  concept_id: string;
  question_type: 'multiple_choice' | 'short_answer';
  difficulty: string;
  prompt: string;
  options: string[];
  evidence?: string | null;
  source_name?: string | null;
}

export interface GeneratedQuizHint {
  level: number;
  reveals: string;
  title: string;
  text: string;
}

export interface GeneratedFlashcard {
  id: string;
  front: string;
  back: string;
  difficulty?: string;
  source_name?: string | null;
}

export const generateWorkspaceQuiz = async (
  workspaceId: string,
  conceptId: string,
  questionMode: 'mixed' | 'mcq' | 'short_answer' = 'mixed',
  difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium',
) => {
  const response = await client.post<{ concept_id: string; title: string; instructions: string; questions: GeneratedQuizQuestion[] }>('/api/quiz/generate', {
    workspace_id: workspaceId,
    concept_id: conceptId,
    question_mode: questionMode,
    difficulty,
  });
  return response.data;
};

export const getGeneratedQuizHint = async (payload: {
  workspace_id: string;
  question_id: string;
  hint_level: number;
  student_answer?: string | null;
}) => {
  const response = await client.post<{
    question_id: string;
    hint_level: number;
    max_hint_level: number;
    hint: GeneratedQuizHint;
    hints_used: number;
  }>('/api/quiz/hint', payload);
  return response.data;
};

export const answerGeneratedQuiz = async (payload: {
  student_id: string;
  workspace_id: string;
  question_id: string;
  selected_option?: number | null;
  answer_text?: string;
  hints_used: number;
  time_taken: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}) => {
  const response = await client.post<{
    success: boolean;
    student: unknown;
    is_correct: boolean;
    selected_answer: string;
    correct_answer: string;
    explanation: string;
    evidence?: string | null;
    source_name?: string | null;
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

export const reviewGeneratedFlashcard = async (payload: {
  student_id: string;
  workspace_id: string;
  concept_id: string;
  card_id: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
}) => {
  const response = await client.post('/api/flashcards/review', payload);
  return response.data;
};

export const getDueFlashcards = async (studentId: string, workspaceId?: string) => {
  const response = await client.get<{ student_id: string; due_reviews: unknown[] }>('/api/flashcards/due', {
    params: { student_id: studentId, workspace_id: workspaceId },
  });
  return response.data;
};
