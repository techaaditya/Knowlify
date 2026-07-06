import { create } from 'zustand';
import { clearStoredToken, getStoredToken, setStoredToken } from '../api/client';
import {
  AuthResponse,
  AuthUser,
  loginRequest,
  meRequest,
  signupRequest,
  googleRequest,
} from '../api/auth';
import { useUserStore } from './userStore';
import { resetUserScopedStores } from './resetStores';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  /** Validate a persisted token on app start. */
  bootstrap: () => Promise<void>;
  setSession: (res: AuthResponse, remember?: boolean) => void;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getStoredToken(),
  status: 'loading',

  bootstrap: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ status: 'unauthenticated', user: null, token: null });
      return;
    }
    try {
      const user = await meRequest();
      // Bind the learner identity to the authenticated user.
      useUserStore.setState({ studentId: String(user.id) });
      set({ user, token, status: 'authenticated' });
    } catch {
      clearStoredToken();
      set({ user: null, token: null, status: 'unauthenticated' });
    }
  },

  setSession: (res, remember = true) => {
    setStoredToken(res.token, remember);
    // Fresh session: clear any previous user's cached data, then bind identity.
    resetUserScopedStores();
    useUserStore.setState({ studentId: String(res.user.id) });
    set({ user: res.user, token: res.token, status: 'authenticated' });
  },

  login: async (email, password, remember) => {
    const res = await loginRequest(email, password);
    get().setSession(res, remember);
  },

  signup: async (name, email, password) => {
    const res = await signupRequest(name, email, password);
    get().setSession(res, true);
  },

  loginWithGoogle: async (credential) => {
    const res = await googleRequest(credential);
    get().setSession(res, true);
  },

  logout: () => {
    clearStoredToken();
    // Drop all cached user-scoped data so the next user starts clean.
    resetUserScopedStores();
    useUserStore.setState({ studentId: '' });
    set({ user: null, token: null, status: 'unauthenticated' });
    // Reset the URL to the login screen.
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  },
}));
