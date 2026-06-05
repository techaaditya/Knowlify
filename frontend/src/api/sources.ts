import client from './client';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  total_sources: number;
  total_chunks: number;
  total_entities: number;
  total_relationships: number;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  workspace_id: string;
  source_type: string;
  source_name: string;
  original_location?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_stage?: string;
  progress_percent: number;
  metadata_json?: Record<string, unknown>;
  error_message?: string;
  chunk_count: number;
  entity_count: number;
  relationship_count: number;
  ai_summary?: string;
  key_topics?: string[];
  extracted_entities?: string[];
  relationship_insights?: string[];
  suggested_questions?: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDashboard {
  workspace: Workspace;
  recent_sources: Array<{
    id: string;
    source_name: string;
    source_type: string;
    processing_status: string;
    chunk_count: number;
    entity_count: number;
    created_at: string;
  }>;
  popular_topics: string[];
  knowledge_growth: Array<{
    date: string;
    entities: number;
    relationships: number;
    source_name: string;
  }>;
  recent_conversations: Array<Record<string, unknown>>;
}

export const FILE_LIMITS = {
  maxFileSize: 50 * 1024 * 1024,
  maxFiles: 20,
  maxBatchSize: 500 * 1024 * 1024,
  allowedExtensions: ['.pdf', '.docx', '.pptx', '.txt', '.md'],
};

export function validateFiles(files: File[]): string | null {
  if (files.length === 0) return 'Please select at least one file.';
  if (files.length > FILE_LIMITS.maxFiles) {
    return `Maximum ${FILE_LIMITS.maxFiles} files per upload.`;
  }
  let totalSize = 0;
  for (const file of files) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!FILE_LIMITS.allowedExtensions.includes(ext)) {
      return `"${file.name}" is not supported. Allowed: PDF, DOCX, PPTX, TXT, MD.`;
    }
    if (file.size > FILE_LIMITS.maxFileSize) {
      return `"${file.name}" exceeds the 50 MB limit.`;
    }
    totalSize += file.size;
  }
  if (totalSize > FILE_LIMITS.maxBatchSize) {
    return 'Total upload size exceeds 500 MB limit.';
  }
  return null;
}

export const getWorkspaces = async () => {
  const res = await client.get<Workspace[]>('/api/workspaces');
  return res.data;
};

export const getWorkspace = async (id: string) => {
  const res = await client.get<Workspace>(`/api/workspaces/${id}`);
  return res.data;
};

export const getWorkspaceDashboard = async (id: string) => {
  const res = await client.get<WorkspaceDashboard>(`/api/workspaces/${id}/dashboard`);
  return res.data;
};

export const getWorkspaceGraph = async (id: string, sourceIds?: string[]) => {
  const params = sourceIds?.length ? { source_ids: sourceIds.join(',') } : undefined;
  const res = await client.get(`/api/workspaces/${id}/graph`, { params });
  return res.data;
};

export interface GraphData {
  nodes: Array<{
    id: string;
    display_name: string;
    description: string;
    difficulty: number;
    prerequisites: string[];
  }>;
  edges: Array<{ from: string; to: string }>;
}

export const getWorkspaceSources = async (
  workspaceId: string,
  params?: { search?: string; source_type?: string; sort?: string }
) => {
  const res = await client.get<Source[]>(`/api/sources/workspace/${workspaceId}`, { params });
  return res.data;
};

export const uploadSources = async (workspaceId: string, files: File[]) => {
  const formData = new FormData();
  formData.append('workspace_id', workspaceId);
  files.forEach((f) => formData.append('files', f));
  const res = await client.post<{ sources: Source[]; message: string }>(
    '/api/sources/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
};

export const pasteSource = async (workspaceId: string, title: string, content: string) => {
  const res = await client.post<Source>('/api/sources/paste', {
    workspace_id: workspaceId,
    title,
    content,
  });
  return res.data;
};

export const importWebsite = async (workspaceId: string, url: string) => {
  const res = await client.post<Source>('/api/sources/website', {
    workspace_id: workspaceId,
    url,
  });
  return res.data;
};

export interface YouTubePreview {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

export const previewYouTube = async (url: string) => {
  const res = await client.get<YouTubePreview>('/api/sources/youtube/preview', {
    params: { url },
  });
  return res.data;
};

export const importYouTube = async (workspaceId: string, url: string) => {
  const res = await client.post<Source>('/api/sources/youtube', {
    workspace_id: workspaceId,
    url,
  });
  return res.data;
};

export const getSourceStatus = async (sourceId: string) => {
  const res = await client.get(`/api/sources/${sourceId}/status`);
  return res.data;
};

export const updateSource = async (sourceId: string, source_name: string) => {
  const res = await client.patch<Source>(`/api/sources/${sourceId}`, { source_name });
  return res.data;
};

export const reprocessSource = async (sourceId: string) => {
  const res = await client.post<Source>(`/api/sources/${sourceId}/reprocess`);
  return res.data;
};

export const deleteSource = async (sourceId: string) => {
  const res = await client.delete(`/api/sources/${sourceId}`);
  return res.data;
};
