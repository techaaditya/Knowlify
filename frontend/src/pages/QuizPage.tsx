import React, { useState, useEffect } from 'react';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useSourcesStore } from '../store/sourcesStore';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';

export const QuizPage: React.FC = () => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((s) => s.getSelectedSources());

  const studentData = useUserStore((state) => state.studentData);
  const recordAttempt = useUserStore((state) => state.recordAttempt);

  const [simTopic, setSimTopic] = useState('');
  const [simResult, setSimResult] = useState('correct');
  const [simErrorType, setSimErrorType] = useState('Concept misunderstanding');
  const [simHints, setSimHints] = useState(0);
  const [simTime, setSimTime] = useState(45);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      const topic = selectedNodeId || graphData.nodes[0].id;
      setSimTopic(topic);
    }
  }, [graphData, selectedNodeId]);

  const handleSubmitAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simTopic) return;

    setSimulating(true);
    const payload = {
      topic_name: simTopic,
      question_id: `Q_SIM_${Date.now().toString().slice(-4)}`,
      is_correct: simResult === 'correct',
      error_type: simResult === 'correct' ? null : simErrorType,
      hints_used: Number(simHints),
      time_taken: Number(simTime),
    };

    try {
      await recordAttempt(payload);
      setSimHints(0);
      setSimTime(45);
    } catch (err) {
      console.error('Failed to post attempt:', err);
    } finally {
      setSimulating(false);
    }
  };

  const topicDetails = studentData && simTopic ? studentData.topics[simTopic] : null;
  const masteryScore = topicDetails ? topicDetails.mastery_score : 0;

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />

      <div className="dashboard-header">
        <div className="header-title">
          <h2>Quiz</h2>
          <p>Practice concepts extracted from your selected knowledge sources</p>
        </div>
      </div>

      {selectedSources.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-theme-muted text-sm">
            Select at least one completed source from the Sources page to generate quiz topics.
          </p>
        </div>
      ) : !graphData || graphData.nodes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-theme-muted text-sm">
            Your selected sources are still processing or contain no extractable concepts yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3>Practice Quiz</h3>
              <span className="badge">Mastery Tracking</span>
            </div>

            <form onSubmit={handleSubmitAttempt} className="simulator-form text-left p-4">
              <div className="form-group">
                <label htmlFor="sim-topic">Concept Topic</label>
                <select
                  id="sim-topic"
                  value={simTopic}
                  onChange={(e) => {
                    setSimTopic(e.target.value);
                    setSelectedNodeId(e.target.value);
                  }}
                  className="form-control"
                  required
                >
                  {graphData.nodes.map((node) => (
                    <option key={node.id} value={node.id}>{node.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="sim-correct">Result</label>
                  <select
                    id="sim-correct"
                    value={simResult}
                    onChange={(e) => setSimResult(e.target.value)}
                    className="form-control"
                  >
                    <option value="correct">Correct</option>
                    <option value="incorrect">Incorrect</option>
                  </select>
                </div>
                {simResult === 'incorrect' && (
                  <div className="form-group">
                    <label htmlFor="sim-error-type">Error Type</label>
                    <select
                      id="sim-error-type"
                      value={simErrorType}
                      onChange={(e) => setSimErrorType(e.target.value)}
                      className="form-control"
                    >
                      <option>Concept misunderstanding</option>
                      <option>Formula mistake</option>
                      <option>Calculation error</option>
                      <option>Missing prerequisite</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="sim-hints">Hints Used</label>
                  <input
                    type="number"
                    id="sim-hints"
                    min="0"
                    max="5"
                    value={simHints}
                    onChange={(e) => setSimHints(Number(e.target.value))}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sim-time">Time (seconds)</label>
                  <input
                    type="number"
                    id="sim-time"
                    min="5"
                    max="300"
                    value={simTime}
                    onChange={(e) => setSimTime(Number(e.target.value))}
                    className="form-control"
                  />
                </div>
              </div>

              <button type="submit" disabled={simulating} className="btn btn-primary">
                {simulating ? 'Recording...' : 'Submit Attempt'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Topic Mastery</h3>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Current Topic</p>
                <p className="font-semibold">
                  {graphData.nodes.find((n) => n.id === simTopic)?.display_name || simTopic}
                </p>
              </div>
              <div>
                <p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Mastery Score</p>
                <div className="progress-bar-container">
                  <div className="progress-bar medium" style={{ width: `${masteryScore}%` }} />
                  <span className="progress-text">{masteryScore}%</span>
                </div>
              </div>
              <div>
                <p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Active Sources</p>
                <div className="source-topics">
                  {selectedSources.map((s) => (
                    <span key={s.id} className="source-topic-tag">{s.source_name}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
