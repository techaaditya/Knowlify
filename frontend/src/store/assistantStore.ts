import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AssistantMessageKind = 'assistant' | 'user' | 'hint' | 'notification';

export interface SecondaryAssistantMessage {
  id: string;
  workspaceId: string;
  kind: AssistantMessageKind;
  content: string;
  title?: string;
  createdAt: string;
}

export interface AssistantHelpRequest {
  id: string;
  workspaceId: string;
  conceptId?: string | null;
  title: string;
  prompt: string;
}

interface AssistantState {
  isOpen: boolean;
  messages: SecondaryAssistantMessage[];
  pendingRequest: AssistantHelpRequest | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addMessage: (message: Omit<SecondaryAssistantMessage, 'id' | 'createdAt'> & { id?: string }) => void;
  requestHelp: (request: Omit<AssistantHelpRequest, 'id'>) => void;
  clearPendingRequest: () => void;
  clearWorkspace: (workspaceId: string) => void;
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      isOpen: false,
      messages: [],
      pendingRequest: null,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      addMessage: (message) => set((state) => {
        const id = message.id || makeId();
        if (state.messages.some((item) => item.id === id)) return state;
        return {
          messages: [...state.messages, {
            ...message,
            id,
            createdAt: new Date().toISOString(),
          }].slice(-100),
        };
      }),
      requestHelp: (request) => set({
        isOpen: true,
        pendingRequest: { ...request, id: makeId() },
      }),
      clearPendingRequest: () => set({ pendingRequest: null }),
      clearWorkspace: (workspaceId) => set((state) => ({
        messages: state.messages.filter((item) => item.workspaceId !== workspaceId),
      })),
    }),
    {
      name: 'knowlify-secondary-assistant',
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
