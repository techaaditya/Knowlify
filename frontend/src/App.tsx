import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useUserStore } from './store/userStore';
import { useAuthStore } from './store/authStore';
import { useStudyStore } from './store/studyStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useSourcesStore } from './store/sourcesStore';
import { DashboardPage } from './pages/DashboardPage';
import { StudyPage } from './pages/StudyPage';
import { KnowledgeMapPage } from './pages/KnowledgeMapPage';
import { SourcesPage } from './pages/SourcesPage';
import { KnowledgeDashboardPage } from './pages/KnowledgeDashboardPage';
import { QuizPage } from './pages/QuizPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { WorkspaceHeader } from './components/Workspace/WorkspaceHeader';

type Tab = 'dashboard' | 'sources' | 'chat' | 'graph' | 'quiz' | 'flashcards' | 'analytics';

interface ChatActionPayload {
  conceptId?: string | null;
  mode?: string;
}

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sources', label: 'Sources' },
  { id: 'chat', label: 'Chat' },
  { id: 'graph', label: 'Knowledge Graph' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'analytics', label: 'Analytics' },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [addSourcesTrigger, setAddSourcesTrigger] = useState(0);

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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <KnowledgeDashboardPage />;
      case 'sources':
        return <SourcesPage openModalOnMount={addSourcesTrigger > 0} />;
      case 'chat':
        return (
          <StudyPage
            initialMode={chatInitPayload?.mode}
            onClearInitPayload={() => setChatInitPayload(null)}
          />
        );
      case 'graph':
        return <KnowledgeMapPage />;
      case 'quiz':
        return <QuizPage />;
      case 'flashcards':
        return <FlashcardsPage />;
      case 'analytics':
        return <DashboardPage onLearningAction={handleLearningAction} onChatAction={handleChatAction} />;
      default:
        return <KnowledgeDashboardPage />;
    }
  };

  const [chatInitPayload, setChatInitPayload] = React.useState<ChatActionPayload | null>(null);

  const handleAddSources = () => {
    setActiveTab('sources');
    setAddSourcesTrigger((n) => n + 1);
  };

  const handleLearningAction = (tab: 'graph' | 'quiz' | 'flashcards', conceptId?: string | null) => {
    if (conceptId) setSelectedNodeId(conceptId);
    setActiveTab(tab);
  };

  const handleCreateWorkspace = async () => {
    const name = window.prompt('Name this learning folder');
    if (name?.trim()) await createWorkspace(name.trim());
  };

  const handleChatAction = (conceptId?: string | null, mode?: string) => {
    if (conceptId) setSelectedNodeId(conceptId);
    setChatInitPayload({ conceptId, mode });
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
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="nav-label">Learning Folder</div>
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
            <button type="button" className="btn btn-secondary mt-2 w-full" onClick={handleCreateWorkspace}>New Folder</button>
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
    </div>
  );
};

export default App;
