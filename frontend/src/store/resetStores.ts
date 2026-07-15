import { useUserStore } from './userStore';
import { useWorkspaceStore } from './workspaceStore';
import { useSourcesStore } from './sourcesStore';
import { useStudyStore } from './studyStore';
import { useAssistantStore } from './assistantStore';

/**
 * Wipe all user-scoped cached state. Zustand stores are module singletons that
 * survive an auth change, so this must run on login and logout to prevent one
 * user's workspaces/sources/graph/chat from bleeding into another's session.
 */
export function resetUserScopedStores(): void {
  useWorkspaceStore.setState({
    workspace: null,
    workspaces: [],
    dashboard: null,
    graphData: null,
    error: null,
  });
  useSourcesStore.setState({
    sources: [],
    selectedSourceIds: [],
    error: null,
    search: '',
    filter: 'all',
    sort: 'newest',
  });
  useStudyStore.setState({
    graphData: null,
    selectedNodeId: null,
    selectedNodeData: null,
    error: null,
  });
  useUserStore.setState({ studentData: null, error: null });
  useAssistantStore.setState({
    isOpen: false,
    messages: [],
    pendingRequest: null,
  });
}
