import client from './client';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  concept_id?: string | null;
  mode?: string | null;
  created_at?: string | null;
}

export const getChatHistory = async (workspaceId: string) => {
  const res = await client.get<{ workspace_id: string; messages: StoredChatMessage[] }>(
    '/api/chat/history',
    { params: { workspace_id: workspaceId } }
  );
  return res.data;
};

export const clearChatHistory = async (workspaceId: string) => {
  const res = await client.delete('/api/chat/history', {
    params: { workspace_id: workspaceId },
  });
  return res.data;
};
