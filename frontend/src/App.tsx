import React, { useEffect, useState } from 'react';
import { useUserStore } from './store/userStore';
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

  const currentCourse = useStudyStore((state) => state.currentCourse);
  const setCourse = useStudyStore((state) => state.setCourse);
  const fetchGraphData = useStudyStore((state) => state.fetchGraphData);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);

  const workspace = useWorkspaceStore((s) => s.workspace);
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

          <div className="nav-label">Graph Source</div>
          <div className="course-selector-container">
            <label htmlFor="course-select">Active Graph</label>
            <select
              id="course-select"
              className="course-dropdown"
              value={currentCourse}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="Workspace">Workspace Sources</option>
            </select>
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
