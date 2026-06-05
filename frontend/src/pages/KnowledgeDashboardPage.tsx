import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export const KnowledgeDashboardPage: React.FC = () => {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const dashboard = useWorkspaceStore((s) => s.dashboard);
  const fetchDashboard = useWorkspaceStore((s) => s.fetchDashboard);

  useEffect(() => {
    fetchDashboard();
  }, [workspace?.id, fetchDashboard]);

  const stats = dashboard?.workspace || workspace;

  return (
    <div className="knowledge-dashboard space-y-6">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Knowledge Dashboard</h2>
          <p>Your living knowledge graph at a glance</p>
        </div>
      </div>

      <div className="knowledge-metrics-grid">
        <div className="metric-card">
          <span className="metric-icon">📚</span>
          <span className="metric-value">{stats?.total_sources ?? 0}</span>
          <span className="metric-label">Total Sources</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon">🧩</span>
          <span className="metric-value">{stats?.total_chunks ?? 0}</span>
          <span className="metric-label">Total Chunks</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon">🔷</span>
          <span className="metric-value">{stats?.total_entities ?? 0}</span>
          <span className="metric-label">Total Entities</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon">🔗</span>
          <span className="metric-value">{stats?.total_relationships ?? 0}</span>
          <span className="metric-label">Relationships</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3>Recent Sources</h3>
          </div>
          {dashboard?.recent_sources?.length ? (
            <div className="recent-sources-list">
              {dashboard.recent_sources.map((s) => (
                <div key={s.id} className="recent-source-item">
                  <div>
                    <p className="recent-source-name">{s.source_name}</p>
                    <p className="recent-source-meta">
                      {s.source_type} · {s.chunk_count} chunks · {s.entity_count} entities
                    </p>
                  </div>
                  <span className={`source-status-badge status-${s.processing_status}`}>
                    {s.processing_status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-theme-muted p-4">No sources imported yet.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Popular Topics</h3>
          </div>
          {dashboard?.popular_topics?.length ? (
            <div className="source-topics p-4">
              {dashboard.popular_topics.map((t) => (
                <span key={t} className="source-topic-tag">{t}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-theme-muted p-4">
              Topics will appear as you import sources.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Knowledge Growth</h3>
        </div>
        {dashboard?.knowledge_growth?.length ? (
          <div className="knowledge-growth-chart">
            {dashboard.knowledge_growth.map((point, idx) => (
              <div key={idx} className="growth-bar-item">
                <div className="growth-bar-label">{point.source_name.slice(0, 20)}</div>
                <div className="growth-bar-track">
                  <div
                    className="growth-bar-fill entities"
                    style={{ width: `${Math.min(point.entities * 10, 100)}%` }}
                  />
                  <div
                    className="growth-bar-fill relations"
                    style={{ width: `${Math.min(point.relationships * 15, 100)}%` }}
                  />
                </div>
                <div className="growth-bar-stats">
                  {point.entities} entities · {point.relationships} relations
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-theme-muted p-4">
            Your knowledge graph will grow as you add sources.
          </p>
        )}
      </div>
    </div>
  );
};
