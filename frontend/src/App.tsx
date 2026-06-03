import React, { useEffect, useState } from 'react';
import { useUserStore } from './store/userStore';
import { useStudyStore } from './store/studyStore';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { StudyPage } from './pages/StudyPage';
import { KnowledgeMapPage } from './pages/KnowledgeMapPage';

type Tab = 'map' | 'study' | 'upload' | 'dashboard';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  
  const studentData = useUserStore((state) => state.studentData);
  const fetchStudentData = useUserStore((state) => state.fetchStudentData);
  
  const currentCourse = useStudyStore((state) => state.currentCourse);
  const setCourse = useStudyStore((state) => state.setCourse);
  const fetchGraphData = useStudyStore((state) => state.fetchGraphData);

  // Load initial data
  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  useEffect(() => {
    fetchGraphData(currentCourse);
  }, [currentCourse, fetchGraphData]);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCourse(e.target.value);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'map':
        return <KnowledgeMapPage />;
      case 'study':
        return <StudyPage />;
      case 'upload':
        return <UploadPage />;
      case 'dashboard':
        return <DashboardPage />;
      default:
        return <KnowledgeMapPage />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar text-left">
        <div className="brand-container">
          <span className="brand-icon">🧠</span>
          <div className="brand-text">
            <h1>KNOWLIFY</h1>
            <p>ACLS Context Engine</p>
          </div>
        </div>
        
        <nav className="nav-menu">
          <div className="nav-label">NAVIGATION</div>
          <div className="flex flex-col gap-1 text-xs">
            <button 
              onClick={() => setActiveTab('map')}
              className={`text-left px-3 py-2 rounded font-medium transition-colors ${
                activeTab === 'map' ? 'bg-[#FAF9F6] text-theme-text font-bold border-l-2 border-mastery-unstarted-border' : 'text-theme-secondary hover:bg-theme-bg/50'
              }`}
            >
              📐 Knowledge Map
            </button>
            <button 
              onClick={() => setActiveTab('study')}
              className={`text-left px-3 py-2 rounded font-medium transition-colors ${
                activeTab === 'study' ? 'bg-[#FAF9F6] text-theme-text font-bold border-l-2 border-mastery-unstarted-border' : 'text-theme-secondary hover:bg-theme-bg/50'
              }`}
            >
              📖 Generative Study
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`text-left px-3 py-2 rounded font-medium transition-colors ${
                activeTab === 'upload' ? 'bg-[#FAF9F6] text-theme-text font-bold border-l-2 border-mastery-unstarted-border' : 'text-theme-secondary hover:bg-theme-bg/50'
              }`}
            >
              📄 Document Pipeline
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`text-left px-3 py-2 rounded font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-[#FAF9F6] text-theme-text font-bold border-l-2 border-mastery-unstarted-border' : 'text-theme-secondary hover:bg-theme-bg/50'
              }`}
            >
              📊 Diagnostic Report
            </button>
          </div>

          <div className="nav-label">COURSES & GRAPHS</div>
          <div className="course-selector-container">
            <label htmlFor="course-select">Active Knowledge Graph</label>
            <select 
              id="course-select" 
              className="course-dropdown"
              value={currentCourse}
              onChange={handleCourseChange}
            >
              <option value="Calculus">📐 Calculus Course (Simulated)</option>
              <option value="VoiceBanking">🎙️ Voice Banking Paper (sample.pdf)</option>
            </select>
          </div>
          
          <div className="nav-label">ACTIVE STUDENT</div>
          {studentData ? (
            <div className="student-card">
              <div className="student-avatar">
                {studentData.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="student-info">
                <h3>{studentData.name}</h3>
                <p>Student ID: {studentData.student_id}</p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-theme-muted">Loading Student...</div>
          )}
          
          <div className="nav-label">NODE MASTERY</div>
          <div className="legend-list">
            <div className="legend-item">
              <span className="legend-color strong"></span>
              <span className="legend-text">Strong Mastery (&ge;80%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color medium"></span>
              <span className="legend-text">Medium Mastery (50%–79%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color weak"></span>
              <span className="legend-text">Weak Mastery (&lt;50%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color unstarted"></span>
              <span className="legend-text">Not Started (0%)</span>
            </div>
          </div>

          <div className="nav-label">EDGE CONNECTIONS</div>
          <div className="edge-legend">
            <div className="edge-legend-item">
              <div className="edge-line prereq"></div>
              Prerequisite (incoming)
            </div>
            <div className="edge-legend-item">
              <div className="edge-line unlock"></div>
              Unlocks (outgoing)
            </div>
            <div className="edge-legend-item">
              <div className="edge-line default"></div>
              Dependency link
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
