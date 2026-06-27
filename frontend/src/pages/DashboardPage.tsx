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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDashboardEngineSummary(studentId, workspace?.id)
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
  }, [studentId, workspace?.id]);

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
          <LearningVelocityChart points={dashboard.learning_velocity} />
        </div>
      </div>

      <div className="card border-l-4 border-l-theme-primary">
        <div className="card-header">
          <h3>Adaptive Next Step</h3>
          <span className="badge">{recommendation?.prerequisite_source || dashboard.context_graph.source}</span>
        </div>
        {recommendation ? (
          <>
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
          <div className="flex flex-wrap gap-3 mt-5">
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
