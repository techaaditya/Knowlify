import { create } from 'zustand';
import client from '../api/client';

interface Student {
  student_id: string;
  name: string;
  created_at: string;
  topics: Record<string, {
    total_attempts: number;
    correct_answers: number;
    wrong_answers: number;
    hints_used: number;
    total_time_taken: number;
    mastery_score: number;
    status: string;
    error_types: Record<string, number>;
    last_revised: string | null;
  }>;
  attempt_history: Array<unknown>;
}

interface UserState {
  studentId: string;
  studentData: Student | null;
  loading: boolean;
  error: string | null;
  fetchStudentData: () => Promise<void>;
  recordAttempt: (attempt: {
    topic_name: string;
    question_id: string;
    is_correct: boolean;
    error_type: string | null;
    hints_used: number;
    time_taken: number;
  }) => Promise<any>;
}

export const useUserStore = create<UserState>((set, get) => ({
  studentId: 'S001',
  studentData: null,
  loading: false,
  error: null,
  fetchStudentData: async () => {
    set({ loading: true, error: null });
    try {
      const res = await client.get('/api/student');
      // Resolve Alex Johnson (S001) out of dictionary
      const studentId = get().studentId;
      const data = res.data[studentId] || null;
      set({ studentData: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  recordAttempt: async (attempt) => {
    set({ loading: true });
    try {
      const res = await client.post('/api/attempt', {
        student_id: get().studentId,
        ...attempt,
      });
      if (res.data.success) {
        set({ studentData: res.data.student, loading: false });
      }
      return res.data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
