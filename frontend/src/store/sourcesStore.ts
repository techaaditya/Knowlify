import { create } from 'zustand';
import {
  Source,
  getWorkspaceSources,
  uploadSources,
  pasteSource,
  importWebsite,
  importYouTube,
  deleteSource,
  reprocessSource,
  updateSource,
  validateFiles,
} from '../api/sources';

interface SourcesState {
  sources: Source[];
  selectedSourceIds: string[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  search: string;
  filter: string;
  sort: string;
  setSearch: (search: string) => void;
  setFilter: (filter: string) => void;
  setSort: (sort: string) => void;
  toggleSourceSelection: (sourceId: string) => void;
  selectAllCompleted: () => void;
  clearSelection: () => void;
  getSelectedSources: () => Source[];
  fetchSources: (workspaceId: string) => Promise<void>;
  uploadFiles: (workspaceId: string, files: File[]) => Promise<void>;
  pasteText: (workspaceId: string, title: string, content: string) => Promise<void>;
  addWebsite: (workspaceId: string, url: string) => Promise<void>;
  addYouTube: (workspaceId: string, url: string) => Promise<void>;
  removeSource: (sourceId: string) => Promise<void>;
  retrySource: (sourceId: string) => Promise<void>;
  renameSource: (sourceId: string, name: string) => Promise<void>;
}

export const useSourcesStore = create<SourcesState>((set, get) => ({
  sources: [],
  selectedSourceIds: [],
  loading: false,
  uploading: false,
  error: null,
  search: '',
  filter: 'all',
  sort: 'newest',

  setSearch: (search) => set({ search }),
  setFilter: (filter) => set({ filter }),
  setSort: (sort) => set({ sort }),

  toggleSourceSelection: (sourceId) => {
    set((state) => {
      const selected = state.selectedSourceIds.includes(sourceId)
        ? state.selectedSourceIds.filter((id) => id !== sourceId)
        : [...state.selectedSourceIds, sourceId];
      return { selectedSourceIds: selected };
    });
  },

  selectAllCompleted: () => {
    const completed = get()
      .sources.filter((s) => s.processing_status === 'completed')
      .map((s) => s.id);
    set({ selectedSourceIds: completed });
  },

  clearSelection: () => set({ selectedSourceIds: [] }),

  getSelectedSources: () => {
    const { sources, selectedSourceIds } = get();
    return sources.filter(
      (s) => selectedSourceIds.includes(s.id) && s.processing_status === 'completed'
    );
  },

  fetchSources: async (workspaceId) => {
    const { search, filter, sort, selectedSourceIds } = get();
    set({ loading: true, error: null });
    try {
      const sources = await getWorkspaceSources(workspaceId, {
        search: search || undefined,
        source_type: filter !== 'all' ? filter : undefined,
        sort,
      });
      const completedIds = sources
        .filter((s) => s.processing_status === 'completed')
        .map((s) => s.id);
      const kept = selectedSourceIds.filter((id) => completedIds.includes(id));
      const selected = kept.length > 0 ? kept : completedIds;
      set({ sources, selectedSourceIds: selected, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sources';
      set({ error: message, loading: false });
    }
  },

  uploadFiles: async (workspaceId, files) => {
    const validationError = validateFiles(files);
    if (validationError) {
      set({ error: validationError });
      throw new Error(validationError);
    }
    set({ uploading: true, error: null });
    try {
      const result = await uploadSources(workspaceId, files);
      set((state) => ({
        sources: [...result.sources, ...state.sources],
        uploading: false,
      }));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Upload failed');
      set({ error: String(message), uploading: false });
      throw new Error(String(message));
    }
  },

  pasteText: async (workspaceId, title, content) => {
    set({ uploading: true, error: null });
    try {
      const source = await pasteSource(workspaceId, title, content);
      set((state) => ({ sources: [source, ...state.sources], uploading: false }));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save note';
      set({ error: String(message), uploading: false });
      throw new Error(String(message));
    }
  },

  addWebsite: async (workspaceId, url) => {
    set({ uploading: true, error: null });
    try {
      const source = await importWebsite(workspaceId, url);
      set((state) => ({ sources: [source, ...state.sources], uploading: false }));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to import website';
      set({ error: String(message), uploading: false });
      throw new Error(String(message));
    }
  },

  addYouTube: async (workspaceId, url) => {
    set({ uploading: true, error: null });
    try {
      const source = await importYouTube(workspaceId, url);
      set((state) => ({ sources: [source, ...state.sources], uploading: false }));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to import YouTube video';
      set({ error: String(message), uploading: false });
      throw new Error(String(message));
    }
  },

  removeSource: async (sourceId) => {
    await deleteSource(sourceId);
    set((state) => ({
      sources: state.sources.filter((s) => s.id !== sourceId),
      selectedSourceIds: state.selectedSourceIds.filter((id) => id !== sourceId),
    }));
  },

  retrySource: async (sourceId) => {
    const updated = await reprocessSource(sourceId);
    set((state) => ({
      sources: state.sources.map((s) => (s.id === sourceId ? updated : s)),
    }));
  },

  renameSource: async (sourceId, name) => {
    const updated = await updateSource(sourceId, name);
    set((state) => ({
      sources: state.sources.map((s) => (s.id === sourceId ? updated : s)),
    }));
  },
}));
