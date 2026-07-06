import React, { useEffect, useMemo, useState } from 'react';
import { DashboardEngineSummary, getDashboardEngineSummary } from '../api/client';
import { MasteryRadar } from '../components/Dashboard/MasteryRadar';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';

const actionLabel = (value?: string | null) => value ? value.split('_').join(' ') : 'None';
const compactPercent = (value: number) => `${Math.round(value)}%`;
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const LearningVelocityChart: React.FC<{ points: DashboardEngineSummary['learning_velocity'] }> = ({ points }) => {
  const width = 520;
  const height = 210;
  const padding = 34;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * chartWidth;
    const y = padding + chartHeight - (clampPercent(point.cumulative_accuracy) / 100) * chartHeight;
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="velocity-chart" aria-label="Learning velocity line chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padding + chartHeight - (tick / 100) * chartHeight;
          return (
            <g key={tick}>
              <line className="chart-grid-line" x1={padding} x2={width - padding} y1={y} y2={y} />
              <text className="chart-axis-label" x={8} y={y + 4}>{tick}%</text>
            </g>
          );
        })}
        <path className="velocity-area" d={`${path} L ${coordinates[coordinates.length - 1]?.x || padding} ${height - padding} L ${coordinates[0]?.x || padding} ${height - padding} Z`} />
        <path className="velocity-line" d={path} />
        {coordinates.map((point) => (
          <g key={point.step}>
            <circle className="velocity-point" cx={point.x} cy={point.y} r="5" />
            <text className="chart-axis-label" x={point.x} y={height - 10} textAnchor="middle">A{point.step}</text>
          </g>
        ))}
      </svg>
      <div className="chart-caption">
        {points.map((point) => (
          <span key={point.step}>
            Attempt {point.step}: {point.cumulative_accuracy}% ({point.topic})
          </span>
        ))}
      </div>
    </div>
  );
};

const WeakAreaChart: React.FC<{ areas: DashboardEngineSummary['weak_areas'] }> = ({ areas }) => (
  <div className="weak-chart">
    {areas.slice(0, 4).map((area, index) => (
      <div key={area.concept_id} className="weak-chart-row">
        <div className="weak-chart-label">
          <strong>{index + 1}. {area.concept_id}</strong>
          <span>{area.reason}</span>
        </div>
        <div className="weak-chart-track">
          <div className="weak-chart-fill" style={{ width: `${clampPercent(area.mastery)}%` }} />
          <span>{area.mastery}%</span>
        </div>
      </div>
    ))}
  </div>
);

const HeatmapChart: React.FC<{ days: DashboardEngineSummary['study_heatmap'] }> = ({ days }) => (
  <div className="study-heatmap-grid">
    {days.map((day) => (
      <div
        key={day.date}
        title={`${day.date}: ${day.attempts} attempts`}
        className={`heatmap-cell intensity-${Math.min(4, Math.max(1, day.intensity))}`}
      >
        <span>{day.attempts}</span>
        <small>{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
      </div>
    ))}
  </div>
);

const ContextGraphChart: React.FC<{ graph: DashboardEngineSummary['context_graph'] }> = ({ graph }) => {
  const bottlenecks = graph.bottlenecks.slice(0, 3);

  return (
    <div className="context-graph-chart">
      <div className="context-graph-stats">
        <div>
          <span>Nodes</span>
          <strong>{graph.node_count}</strong>
        </div>
        <div>
          <span>Edges</span>
          <strong>{graph.edge_count}</strong>
        </div>
        <div>
          <span>Covered</span>
          <strong>{graph.covered_topics}</strong>
        </div>
      </div>
      <div className="mini-graph" aria-label="Context graph bottleneck preview">
        {bottlenecks.length ? bottlenecks.map((item) => (
          <div key={item.concept_id} className="mini-graph-row">
            <div className="mini-node weak">{item.weak_prerequisites.join(', ')}</div>
            <div className="mini-edge" />
            <div className="mini-node blocked">{item.concept_id}</div>
          </div>
        )) : (
          <div className="mini-node strong">No blocked concepts</div>
        )}
      </div>
    </div>
  );
};

interface DashboardPageProps {
  onLearningAction: (tab: 'graph' | 'quiz' | 'flashcards', conceptId?: string | null) => void;
  onChatAction?: (conceptId?: string | null, mode?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onLearningAction, onChatAction }) => {
  const studentId = useUserStore((state) => state.studentId);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const [dashboard, setDashboard] = useState<DashboardEngineSummary | null>(null);
  const [scope, setScope] = useState<'workspace' | 'overall'>('workspace');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDashboardEngineSummary(studentId, workspace?.id, scope)
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
  }, [studentId, workspace?.id, scope]);

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
  const recommendedConcept = recommendation?.recommended_concept || recommendation?.concept_id;
  // Urgent (rose) callout when there is a misconception or high forgetting risk; otherwise a calmer amber tone.
  const isUrgent = Boolean(recommendation?.misconception) || (recommendation?.forgetting_risk || '').toLowerCase() === 'high';

  return (
    <div className="space-y-8">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Dashboard Engine</h2>
          <p>{scope === 'overall' ? 'Overall analysis across all learning folders' : `Analysis for ${workspace?.name || 'the active learning folder'}`}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 lg:items-end">
          <div className="flex gap-2 justify-end">
            <button type="button" className={`btn ${scope === 'workspace' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScope('workspace')}>This Folder</button>
            <button type="button" className={`btn ${scope === 'overall' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setScope('overall')}>Overall</button>
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
        <div className="card">
          <div className="card-header">
            <h3>Revision Planner</h3>
            <span className="badge">{dashboard.revision_plan.length} due</span>
          </div>
          {dashboard.revision_plan.length ? (
            <div className="space-y-3">
              {dashboard.revision_plan.slice(0, 5).map((item) => (
                <div key={`${item.type}-${item.concept_id}-${item.card_id || item.next_review_date}`} className="recommendation-box">
                  <strong>{item.concept_id}</strong>
                  <p>{item.reason}</p>
                  <p className="text-theme-muted">Due: {item.next_review_date}</p>
                  <button
                    type="button"
                    className="btn btn-secondary mt-3"
                    onClick={() => onLearningAction(item.type === 'flashcard_review' ? 'flashcards' : 'quiz', item.concept_id)}
                  >
                    {item.type === 'flashcard_review' ? 'Review Flashcards' : 'Start Review Quiz'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-theme-muted">No review items are due right now.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Source Organization</h3>
            <span className="badge">{scope === 'overall' ? 'All Folders' : 'This Folder'}</span>
          </div>
          <div className="knowledge-metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Sources</span>
              <span className="metric-value">{dashboard.source_organization.total_sources ?? dashboard.source_organization.workspace_count ?? 0}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Processed</span>
              <span className="metric-value">{dashboard.source_organization.completed_sources ?? '-'}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Chunks</span>
              <span className="metric-value">{dashboard.source_organization.total_chunks ?? '-'}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Relations</span>
              <span className="metric-value">{dashboard.source_organization.total_relationships ?? '-'}</span>
            </div>
          </div>
          {dashboard.source_organization.source_types && (
            <div className="mt-4 space-y-2">
              {Object.entries(dashboard.source_organization.source_types).map(([type, count]) => (
                <div key={type} className="weak-chart-row">
                  <div className="weak-chart-label"><strong>{type.toUpperCase()}</strong><span>{count} source(s)</span></div>
                  <div className="weak-chart-track"><div className="weak-chart-fill" style={{ width: `${Math.min(100, count * 20)}%` }} /><span>{count}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MasteryRadar data={masteryBars} />

        <div className="card">
          <div className="card-header">
            <h3>Learning Velocity</h3>
            <span className="badge">Accuracy Over Attempts</span>
          </div>
          <LearningVelocityChart points={dashboard.learning_velocity} />
        </div>
      </div>

      <div className={`card adaptive-callout ${isUrgent ? 'urgent' : ''}`}>
        <div className="card-header">
          <h3>Adaptive Next Step</h3>
          <span className="badge">{recommendation?.prerequisite_source || dashboard.context_graph.source}</span>
        </div>
        {recommendation ? (
          <>
          <div className="adaptive-callout-grid">
            <div className="adaptive-panel">
              <p className="adaptive-panel-label">Current Concept</p>
              <p className="adaptive-panel-value">{recommendation.concept_name}</p>
              <p className="adaptive-panel-meta">Mastery: {(recommendation.current_mastery * 100).toFixed(0)}%</p>
              {recommendation.readiness_score !== undefined && recommendation.readiness_score !== null && (
                <p className="adaptive-panel-meta">Readiness: {(recommendation.readiness_score * 100).toFixed(0)}%</p>
              )}
            </div>
            <div className="adaptive-panel">
              <p className="adaptive-panel-label">Next Action</p>
              <p className="adaptive-panel-value">{actionLabel(recommendation.next_action)}</p>
              <p className="adaptive-panel-meta">Recommended: {recommendation.recommended_concept || 'None'}</p>
              {recommendation.weakest_prerequisite && (
                <p className="adaptive-panel-meta">Weakest prerequisite: {recommendation.weakest_prerequisite}</p>
              )}
            </div>
            <div className="adaptive-panel">
              <p className="adaptive-panel-label">Reason</p>
              <p className="adaptive-panel-meta">{recommendation.reason}</p>
              {recommendation.suggested_activity && (
                <p className="adaptive-panel-meta">{recommendation.suggested_activity}</p>
              )}
              <p className="adaptive-panel-meta">Forgetting risk: <strong>{recommendation.forgetting_risk}</strong></p>
            </div>
          </div>
          <div className="adaptive-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onLearningAction('graph', recommendedConcept)}>Open Graph</button>
            {onChatAction && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onChatAction(recommendedConcept, 'explain')}
                title="Open chatbot with this concept pre-loaded in Explain mode"
              >
                💬 Chat with Tutor
              </button>
            )}
            {onChatAction && recommendation?.misconception && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onChatAction(recommendedConcept, 'socratic')}
                title="Socratic questioning to address your misconceptions"
              >
                🤔 Socratic Review
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => onLearningAction('flashcards', recommendedConcept)}>Flashcards</button>
            <button type="button" className="btn btn-primary" onClick={() => onLearningAction('quiz', recommendedConcept)}>Start Quiz</button>
            {recommendation.weakest_prerequisite && <button type="button" className="btn btn-secondary" onClick={() => onLearningAction('flashcards', recommendation.weakest_prerequisite)}>Review Prerequisite</button>}
          </div>
          </>
        ) : (
          <p className="text-xs text-theme-muted">No adaptive recommendation available.</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-header">
            <h3>Weak Areas Ranking</h3>
          </div>
          <WeakAreaChart areas={dashboard.weak_areas} />
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
          <HeatmapChart days={dashboard.study_heatmap} />
          <p className="text-xs text-theme-muted mt-3">Each square shows attempts on a practice day.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3>Context Graph Coverage</h3>
          </div>
          <ContextGraphChart graph={dashboard.context_graph} />
          {dashboard.context_graph.bottlenecks.length > 0 && (
            <div className="blocked-list">
              {dashboard.context_graph.bottlenecks.map((item) => (
                <div key={item.concept_id} className="blocked-item">
                  <span className="blocked-concept">{item.concept_id}</span>
                  <span className="blocked-label">blocked by</span>
                  <span className="blocked-pills">
                    {item.weak_prerequisites.map((prereq) => (
                      <span key={prereq} className="blocked-pill">{prereq}</span>
                    ))}
                  </span>
                </div>
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
                <button type="button" className="btn btn-secondary mt-3" onClick={() => onLearningAction(suggestion.type === 'flashcards' ? 'flashcards' : 'quiz', suggestion.target_concept)}>
                  {suggestion.type === 'flashcards' ? 'Open Flashcards' : 'Start Practice'}
                </button>
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
