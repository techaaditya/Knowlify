import client from './client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  auth_provider: string;
  created_at?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface ForgotResponse {
  message: string;
  reset_token?: string | null;
  reset_link?: string | null;
}

export const signupRequest = async (name: string, email: string, password: string) => {
  const res = await client.post<AuthResponse>('/api/auth/signup', { name, email, password });
  return res.data;
};

export const loginRequest = async (email: string, password: string) => {
  const res = await client.post<AuthResponse>('/api/auth/login', { email, password });
  return res.data;
};

export const googleRequest = async (credential: string) => {
  const res = await client.post<AuthResponse>('/api/auth/google', { credential });
  return res.data;
};

export const meRequest = async () => {
  const res = await client.get<AuthUser>('/api/auth/me');
  return res.data;
};

export const forgotPasswordRequest = async (email: string) => {
  const res = await client.post<ForgotResponse>('/api/auth/forgot-password', { email });
  return res.data;
};

export const resetPasswordRequest = async (token: string, password: string) => {
  const res = await client.post<AuthResponse>('/api/auth/reset-password', { token, password });
  return res.data;
};

/** Extract a human-readable message from an axios error. */
export const authErrorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const anyErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = anyErr?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === 'string') {
    return detail[0].msg.replace(/^Value error,\s*/i, '');
  }
  if (anyErr?.message === 'Network Error') return 'Cannot reach the server. Is the backend running?';
  return fallback;
};
