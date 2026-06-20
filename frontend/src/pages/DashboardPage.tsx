import React, { useEffect, useMemo, useState } from 'react';
import { DashboardEngineSummary, getDashboardEngineSummary } from '../api/client';
import { MasteryRadar } from '../components/Dashboard/MasteryRadar';
import { useUserStore } from '../store/userStore';

const actionLabel = (value?: string | null) => value ? value.split('_').join(' ') : 'None';

const compactPercent = (value: number) => `${Math.round(value)}%`;

export const DashboardPage: React.FC = () => {
  const studentId = useUserStore((state) => state.studentId);
  const [dashboard, setDashboard] = useState<DashboardEngineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDashboardEngineSummary(studentId)
      .then((data) => {
        setDashboard(data);
        setError(null);
      })
      .catch(() => {
        setError('Dashboard engine summary is unavailable.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId]);

  const masteryBars = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.weak_areas
      .slice()
      .sort((a, b) => b.mastery - a.mastery)
      .map((area) => ({ topic: area.concept_id, mastery: area.mastery }));
  }, [dashboard]);

  if (loading) {
    return <div className="text-center p-8">Loading Dashboard Engine...</div>;
  }

  if (error || !dashboard) {
    return <div className="text-center p-8 text-mastery-weak-text">{error || 'No dashboard data available.'}</div>;
  }

  const summary = dashboard.summary;
  const recommendation = dashboard.adaptive_recommendation;
  const maxVelocity = Math.max(...dashboard.learning_velocity.map((point) => point.cumulative_accuracy), 100);

  return (
    <div className="space-y-6">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Dashboard Engine</h2>
          <p>Unified analytics from Student Model, Context Graph, Adaptive Engine, and Generative suggestions</p>
        </div>
        <div className="global-stats">
          <div className="stat-box">
            <span className="stat-label">Mastery</span>
            <span className="stat-value">{compactPercent(summary.average_mastery)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{compactPercent(summary.accuracy_rate)}</span>
          </div>
          <div className={`stat-box warning-box ${summary.misconception_count > 0 ? 'active-misconception' : ''}`}>
            <span className="stat-label">Misconceptions</span>
            <span className="stat-value">{summary.misconception_count}</span>
          </div>
        </div>
      </div>

      <div className="knowledge-metrics-grid">
        <div className="metric-card">
          <span className="metric-value">{summary.total_attempts}</span>
          <span className="metric-label">Attempts</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.topics_attempted}</span>
          <span className="metric-label">Topics</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.average_time_seconds}s</span>
          <span className="metric-label">Avg Time</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{summary.hint_dependency}</span>
          <span className="metric-label">Hints / Attempt</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MasteryRadar data={masteryBars} />

        <div className="card">
          <div className="card-header">
            <h3>Learning Velocity</h3>
            <span className="badge">Accuracy Over Attempts</span>
          </div>
          <div className="space-y-3">
            {dashboard.learning_velocity.map((point) => (
              <div key={point.step} className="space-y-1">
                <div className="flex justify-between text-xs text-theme-secondary">
                  <span>Attempt {point.step} - {point.topic}</span>
                  <span>{point.cumulative_accuracy}%</span>
                </div>
                <div className="w-full bg-[#F2EFE9] h-2 rounded-full overflow-hidden border border-theme-border/30">
                  <div
                    className="h-full rounded-full bg-mastery-strong-border"
                    style={{ width: `${Math.min(100, (point.cumulative_accuracy / maxVelocity) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card border-l-4 border-l-theme-primary">
        <div className="card-header">
          <h3>Adaptive Next Step</h3>
          <span className="badge">{recommendation?.prerequisite_source || dashboard.context_graph.source}</span>
        </div>
        {recommendation ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <p className="text-theme-muted uppercase tracking-wider text-[10px]">Current Concept</p>
              <p className="text-theme-text font-bold text-sm">{recommendation.concept_name}</p>
              <p className="text-theme-muted">Mastery: {(recommendation.current_mastery * 100).toFixed(0)}%</p>
              {recommendation.readiness_score !== undefined && recommendation.readiness_score !== null && (
                <p className="text-theme-muted">Readiness: {(recommendation.readiness_score * 100).toFixed(0)}%</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-theme-muted uppercase tracking-wider text-[10px]">Next Action</p>
              <p className="text-theme-text font-bold text-sm">{actionLabel(recommendation.next_action)}</p>
              <p className="text-theme-muted">Recommended: {recommendation.recommended_concept || 'None'}</p>
              {recommendation.weakest_prerequisite && (
                <p className="text-theme-muted">Weakest prerequisite: {recommendation.weakest_prerequisite}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-theme-muted uppercase tracking-wider text-[10px]">Reason</p>
              <p className="text-theme-text leading-relaxed">{recommendation.reason}</p>
              {recommendation.suggested_activity && (
                <p className="text-theme-text leading-relaxed">{recommendation.suggested_activity}</p>
              )}
              <p className="text-theme-muted">Forgetting risk: {recommendation.forgetting_risk}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-theme-muted">No adaptive recommendation available.</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-header">
            <h3>Weak Areas Ranking</h3>
          </div>
          <div className="space-y-3">
            {dashboard.weak_areas.slice(0, 4).map((area, index) => (
              <div key={area.concept_id} className="recommendation-box">
                <div className="flex justify-between gap-3">
                  <strong>{index + 1}. {area.concept_id}</strong>
                  <span>{area.mastery}%</span>
                </div>
                <p>{area.reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Misconception Patterns</h3>
          </div>
          {dashboard.misconceptions.length ? (
            <ul className="error-list">
              {dashboard.misconceptions.map((item) => (
                <li key={`${item.concept_id}-${item.error_type}`}>
                  <span>{item.concept_id}: {item.error_type}</span>
                  <span className="error-count">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-theme-muted">No repeated misconceptions detected.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Study Heatmap</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {dashboard.study_heatmap.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.attempts} attempts`}
                className={`w-9 h-9 rounded border border-theme-border flex items-center justify-center text-[10px] ${
                  day.intensity >= 3
                    ? 'bg-mastery-strong-bg text-mastery-strong-text'
                    : day.intensity === 2
                      ? 'bg-mastery-medium-bg text-mastery-medium-text'
                      : 'bg-mastery-weak-bg text-mastery-weak-text'
                }`}
              >
                {day.attempts}
              </div>
            ))}
          </div>
          <p className="text-xs text-theme-muted mt-3">Each square shows attempts on a practice day.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3>Context Graph Coverage</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="metric-item">
              <span className="metric-label">Nodes</span>
              <span className="metric-value">{dashboard.context_graph.node_count}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Edges</span>
              <span className="metric-value">{dashboard.context_graph.edge_count}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Covered</span>
              <span className="metric-value">{dashboard.context_graph.covered_topics}</span>
            </div>
          </div>
          {dashboard.context_graph.bottlenecks.length > 0 && (
            <div className="mt-4 space-y-2 text-xs">
              {dashboard.context_graph.bottlenecks.map((item) => (
                <p key={item.concept_id} className="recommendation-box revision-needed">
                  {item.concept_id} is blocked by {item.weak_prerequisites.join(', ')}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Generated Study Suggestions</h3>
          </div>
          <div className="space-y-3">
            {dashboard.generative_suggestions.map((suggestion) => (
              <div key={`${suggestion.type}-${suggestion.target_concept}`} className="recommendation-box">
                <strong>{suggestion.title}</strong>
                <p>{suggestion.reason}</p>
                <p className="text-theme-muted">Target: {suggestion.target_concept || 'General review'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Engine Connections</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {dashboard.engine_connections.map((connection) => (
            <div key={connection} className="metric-item text-left">
              <span className="text-xs text-theme-secondary">{connection}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
