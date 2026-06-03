import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
}

export const getAdaptiveDemoRecommendation = async () => {
  const response = await client.get<AdaptiveRecommendation>('/api/adaptive/demo-recommendation');
  return response.data;
};
