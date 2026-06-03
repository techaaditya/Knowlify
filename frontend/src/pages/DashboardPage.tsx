import React, { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';
import { MasteryRadar } from '../components/Dashboard/MasteryRadar';
import { AdaptiveRecommendation, getAdaptiveDemoRecommendation } from '../api/client';

export const DashboardPage: React.FC = () => {
  const studentData = useUserStore((state) => state.studentData);
  const loading = useUserStore((state) => state.loading);
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState<AdaptiveRecommendation | null>(null);
  const [adaptiveLoading, setAdaptiveLoading] = useState(true);
  const [adaptiveError, setAdaptiveError] = useState<string | null>(null);

  useEffect(() => {
    getAdaptiveDemoRecommendation()
      .then((data) => {
        setAdaptiveRecommendation(data);
        setAdaptiveError(null);
      })
      .catch(() => {
        setAdaptiveError('Adaptive recommendation is unavailable.');
      })
      .finally(() => {
        setAdaptiveLoading(false);
      });
  }, []);

  if (loading && !studentData) {
    return <div className="text-center p-8">Loading Student Profile...</div>;
  }

  if (!studentData) {
    return <div className="text-center p-8 text-theme-muted">No student profile loaded.</div>;
  }

  // Calculate stats
  const topics = Object.entries(studentData.topics);
  const radarData = topics.map(([topicId, details]) => ({
    topic: topicId,
    mastery: details.mastery_score
  }));

  const totalMastery = topics.reduce((acc, [_, d]) => acc + d.mastery_score, 0);
  const averageMastery = topics.length > 0 ? Math.round(totalMastery / topics.length) : 0;
  
  const weakTopics = topics.filter(([_, d]) => d.status.toLowerCase() === 'weak').map(([id]) => id);
  
  // Misconception calculations
  let misconceptionsCount = 0;
  topics.forEach(([_, details]) => {
    if (details.error_types) {
      Object.values(details.error_types).forEach(count => {
        if (count >= 3) misconceptionsCount++;
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Student Diagnosis Dashboard</h2>
          <p>Historical scores, weak concepts, and adaptive mastery metrics</p>
        </div>
        <div className="global-stats">
          <div className="stat-box">
            <span className="stat-label">Mastery Rate</span>
            <span className="stat-value">{averageMastery}%</span>
          </div>
          <div className={`stat-box warning-box ${misconceptionsCount > 0 ? 'active-misconception' : ''}`}>
            <span className="stat-label">Misconceptions</span>
            <span className="stat-value">{misconceptionsCount} Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MasteryRadar data={radarData} />
        
        <div className="card">
          <div className="card-header">
            <h3>Diagnostic Analytics</h3>
          </div>
          <div className="space-y-4 text-xs">
            <div className="flex justify-between border-b border-theme-border/20 pb-2">
              <span className="font-semibold text-theme-secondary">Active Student</span>
              <span className="text-theme-text">{studentData.name} ({studentData.student_id})</span>
            </div>
            <div className="flex justify-between border-b border-theme-border/20 pb-2">
              <span className="font-semibold text-theme-secondary">Total Topics Attempted</span>
              <span className="text-theme-text">{topics.length}</span>
            </div>
            <div className="flex justify-between border-b border-theme-border/20 pb-2">
              <span className="font-semibold text-theme-secondary">Practice Questions Solved</span>
              <span className="text-theme-text">{studentData.attempt_history.length}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="font-semibold text-theme-secondary text-mastery-weak-text">Weak Concepts Detected</span>
              <span className="font-bold text-mastery-weak-text">
                {weakTopics.length > 0 ? weakTopics.join(', ') : 'None'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-l-4 border-l-theme-primary">
        <div className="card-header">
          <h3>Adaptive Learning Recommendation</h3>
        </div>
        {adaptiveLoading ? (
          <div className="text-xs text-theme-muted">Loading adaptive recommendation...</div>
        ) : adaptiveError ? (
          <div className="text-xs text-mastery-weak-text">{adaptiveError}</div>
        ) : adaptiveRecommendation ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <p className="text-theme-muted uppercase tracking-wider text-[10px]">Current Concept</p>
              <p className="text-theme-text font-bold text-sm">{adaptiveRecommendation.concept_name}</p>
              <p className="text-theme-muted">
                Mastery: {(adaptiveRecommendation.previous_mastery * 100).toFixed(0)}% -> {(adaptiveRecommendation.current_mastery * 100).toFixed(0)}%
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-theme-muted uppercase tracking-wider text-[10px]">Next Action</p>
              <p className="text-theme-text font-bold text-sm">
                {adaptiveRecommendation.next_action.split('_').join(' ')}
              </p>
              <p className="text-theme-muted">
                Recommended: {adaptiveRecommendation.recommended_concept || 'None'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-theme-muted uppercase tracking-wider text-[10px]">Reason</p>
              <p className="text-theme-text leading-relaxed">{adaptiveRecommendation.reason}</p>
              <p className="text-theme-muted">Forgetting risk: {adaptiveRecommendation.forgetting_risk}</p>
            </div>
          </div>
        ) : null}
      </div>
      
      <div className="card">
        <div className="card-header">
          <h3>Attempt History Logs</h3>
        </div>
        <div className="max-h-[220px] overflow-y-auto pr-1">
          {studentData.attempt_history.length === 0 ? (
            <div className="text-center p-4 text-xs text-theme-muted">No quiz history recorded.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-theme-border text-theme-muted uppercase tracking-wider text-[10px]">
                  <th className="py-2">Question ID</th>
                  <th className="py-2">Topic</th>
                  <th className="py-2">Result</th>
                  <th className="py-2">Hints Used</th>
                  <th className="py-2">Time</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/20">
                {studentData.attempt_history.map((att: any, idx) => (
                  <tr key={idx} className="hover:bg-theme-bg/30">
                    <td className="py-2.5 font-mono">{att.question_id}</td>
                    <td className="py-2.5">{att.topic}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        att.is_correct 
                          ? 'bg-mastery-strong-bg text-mastery-strong-border border border-mastery-strong-border/20' 
                          : 'bg-mastery-weak-bg text-mastery-weak-border border border-mastery-weak-border/20'
                      }`}>
                        {att.is_correct ? 'Correct' : 'Incorrect'}
                      </span>
                    </td>
                    <td className="py-2.5">{att.hints_used}</td>
                    <td className="py-2.5">{att.time_taken_seconds || att.time_taken}s</td>
                    <td className="py-2.5 text-theme-muted">{att.attempted_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
