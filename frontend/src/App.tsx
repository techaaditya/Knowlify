import React, { useEffect, useState } from 'react';
import { Bot, Home, Layers3, Library, LogOut, Network, PenTool, type LucideIcon } from 'lucide-react';
import { useUserStore } from './store/userStore';
import { useAuthStore } from './store/authStore';
import { useStudyStore } from './store/studyStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSourcesStore } from './store/sourcesStore';
import { DashboardPage } from './pages/DashboardPage';
import { StudyPage } from './pages/StudyPage';
import { KnowledgeMapPage } from './pages/KnowledgeMapPage';
import { SourcesPage } from './pages/SourcesPage';
import { GenerateMode, GeneratePage } from './pages/GeneratePage';
import { WorkspaceHeader } from './components/Workspace/WorkspaceHeader';
import { CompanionDock } from './companion/CompanionDock';
import { AICanvasPage } from './pages/AICanvasPage';
import { useCanvasLaunchStore } from './components/AICanvas/canvasLaunchStore';

type Tab = 'dashboard' | 'sources' | 'chat' | 'graph' | 'generate' | 'canvas';
interface ChatActionPayload {
  conceptId?: string | null;
  mode?: string;
  message?: string;
}
export interface GenerateActionRequest {
  id: number;
  mode: GenerateMode;
  conceptId?: string | null;
}

const NAV_ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'sources', label: 'Library', icon: Library },
  { id: 'chat', label: 'AI Tutor', icon: Bot },
  { id: 'graph', label: 'Knowledge Map', icon: Network },
  { id: 'canvas', label: 'AI Canvas', icon: PenTool },
  { id: 'generate', label: 'Study Tools', icon: Layers3 },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [addSourcesTrigger, setAddSourcesTrigger] = useState(0);
  const [generateMode, setGenerateMode] = useState<GenerateMode>('quiz');
  const [pendingGenerateRequest, setPendingGenerateRequest] = useState<GenerateActionRequest | null>(null);

  const studentData = useUserStore((state) => state.studentData);
  const fetchStudentData = useUserStore((state) => state.fetchStudentData);

  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const currentCourse = useStudyStore((state) => state.currentCourse);
  const fetchGraphData = useStudyStore((state) => state.fetchGraphData);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);

  const workspace = useWorkspaceStore((s) => s.workspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const refreshAll = useWorkspaceStore((s) => s.refreshAll);

  const selectedSourceIds = useSourcesStore((s) => s.selectedSourceIds);
  const fetchSources = useSourcesStore((s) => s.fetchSources);

  const canvasLaunchToken = useCanvasLaunchStore((s) => s.requestToken);

  useEffect(() => {
    fetchStudentData();
    refreshAll();
  }, [fetchStudentData, refreshAll]);

  useEffect(() => {
    if (workspace?.id) {
      fetchSources(workspace.id);
    }
  }, [workspace?.id, fetchSources]);

  useEffect(() => {
    if (workspace?.id) {
      fetchGraphData(currentCourse, workspace.id);
    } else {
      fetchGraphData(currentCourse);
    }
  }, [currentCourse, workspace?.id, selectedSourceIds, fetchGraphData]);

  // A canvas launch (from the Knowledge Graph side panel, a wrong quiz
  // answer, a recommendation) switches to the AI Canvas tab. Guarded so it
  // never fires on mount — the store's token starts at 0.
  useEffect(() => {
    if (canvasLaunchToken > 0) setActiveTab('canvas');
  }, [canvasLaunchToken]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onLearningAction={handleLearningAction} onChatAction={handleChatAction} />;
      case 'sources':
        return <SourcesPage openModalOnMount={addSourcesTrigger > 0} />;
      case 'chat':
        return (
          <StudyPage
            initialMode={chatInitPayload?.mode}
            initialMessage={chatInitPayload?.message}
            onClearInitPayload={() => setChatInitPayload(null)}
            onGenerateAction={handleGenerateAction}
          />
        );
      case 'graph':
        return <KnowledgeMapPage />;
      case 'canvas':
        return <AICanvasPage />;
      case 'generate':
        return (
          <GeneratePage
            initialMode={generateMode}
            pendingRequest={pendingGenerateRequest}
            onConsumeRequest={() => setPendingGenerateRequest(null)}
          />
        );
      default:
        return <DashboardPage onLearningAction={handleLearningAction} onChatAction={handleChatAction} />;
    }
  };

  const [chatInitPayload, setChatInitPayload] = React.useState<ChatActionPayload | null>(null);

  const handleAddSources = () => {
    setActiveTab('sources');
    setAddSourcesTrigger((n) => n + 1);
  };

  const handleLearningAction = (tab: 'graph' | 'quiz' | 'flashcards', conceptId?: string | null) => {
    if (conceptId) setSelectedNodeId(conceptId);
    if (tab === 'graph') {
      setActiveTab('graph');
      return;
    }
    setGenerateMode(tab);
    setActiveTab('generate');
  };

  const handleGenerateAction = (mode: GenerateMode, conceptId?: string | null) => {
    if (conceptId) setSelectedNodeId(conceptId);
    setGenerateMode(mode);
    setPendingGenerateRequest({ id: Date.now(), mode, conceptId: conceptId || null });
    setActiveTab('generate');
  };

  const handleCreateWorkspace = async () => {
    const name = window.prompt('Name this workspace');
    if (name?.trim()) await createWorkspace(name.trim());
  };

  const handleChatAction = (conceptId?: string | null, mode?: string, message?: string) => {
    if (conceptId) setSelectedNodeId(conceptId);
    setChatInitPayload({ conceptId, mode, message });
    setActiveTab('chat');
  };

  return (
    <div className="app-container">
      <aside className="app-sidebar text-left">
        <div className="brand-container">
          <span className="brand-icon">🧠</span>
          <div className="brand-text">
            <h1>KNOWLIFY</h1>
            <p>Knowledge Workspace</p>
          </div>
        </div>

        <nav className="nav-menu">
          <div className="nav-label">Navigation</div>
          <ul className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                >
                  <item.icon size={16} aria-hidden />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="nav-label">Workspace</div>
          <div className="course-selector-container">
            <label htmlFor="course-select">Active Workspace</label>
            <select
              id="course-select"
              className="course-dropdown"
              value={workspace?.id || ''}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="button" className="btn btn-secondary mt-2 w-full" onClick={handleCreateWorkspace}>New Workspace</button>
          </div>

          {studentData && (
            <>
              <div className="nav-label">Student</div>
              <div className="student-card">
                <div className="student-avatar">
                  {studentData.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="student-info">
                  <h3>{studentData.name}</h3>
                  <p>{studentData.student_id}</p>
                </div>
              </div>
            </>
          )}
        </nav>

        {authUser && (
          <div className="sidebar-account">
            <div className="sidebar-account-user">
              <div className="student-avatar" aria-hidden="true">
                {authUser.avatar_url ? (
                  <img src={authUser.avatar_url} alt="" className="sidebar-account-avatar" />
                ) : (
                  authUser.name.trim().charAt(0).toUpperCase() || authUser.email.charAt(0).toUpperCase()
                )}
              </div>
              <div className="sidebar-account-info">
                <h3>{authUser.name || 'Account'}</h3>
                <p>{authUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </aside>

      <main className="main-content">
        <WorkspaceHeader
          workspace={workspace}
          onAddSources={handleAddSources}
          onChat={() => setActiveTab('chat')}
        />
        {renderContent()}
      </main>

      {/* AI Learning Companion — always present, lower-right */}
      <CompanionDock />
    </div>
  );
};

export default App;
