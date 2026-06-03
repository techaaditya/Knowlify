import React, { useState, useEffect } from 'react';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { ConceptGraph } from '../components/KnowledgeMap/ConceptGraph';

const ERROR_TYPES: Record<string, string[]> = {
  "Calculus": [
    "Sign error",
    "Formula mistake",
    "Algebraic simplification mistake",
    "Calculation error"
  ],
  "VoiceBanking": [
    "Language mixing syntax error",
    "Intent misclassification",
    "Audio quality distortion",
    "Entity extraction failure"
  ]
};

export const KnowledgeMapPage: React.FC = () => {
  const currentCourse = useStudyStore((state) => state.currentCourse);
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const selectedNodeData = useStudyStore((state) => state.selectedNodeData);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  
  const studentData = useUserStore((state) => state.studentData);
  const recordAttempt = useUserStore((state) => state.recordAttempt);

  // Simulator Form State
  const [simTopic, setSimTopic] = useState('');
  const [simResult, setSimResult] = useState('correct');
  const [simErrorType, setSimErrorType] = useState('');
  const [simHints, setSimHints] = useState(0);
  const [simTime, setSimTime] = useState(45);
  const [simulating, setSimulating] = useState(false);

  // Populate first topic in simulator when graph data loads
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      setSimTopic(graphData.nodes[0].id);
      const errors = ERROR_TYPES[currentCourse] || [];
      if (errors.length > 0) {
        setSimErrorType(errors[0]);
      }
    }
  }, [graphData, currentCourse]);

  // If selected node updates, pre-select it in the simulator
  useEffect(() => {
    if (selectedNodeId) {
      setSimTopic(selectedNodeId);
    }
  }, [selectedNodeId]);

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
      time_taken: Number(simTime)
    };

    try {
      await recordAttempt(payload);
      // Reset form partially
      setSimHints(0);
      setSimTime(45);
    } catch (err) {
      console.error("Failed to post mock attempt:", err);
    } finally {
      setSimulating(false);
    }
  };

  // Details calculations
  const topicDetails = studentData && selectedNodeId ? studentData.topics[selectedNodeId] : null;
  const masteryScore = topicDetails ? topicDetails.mastery_score : 0;
  
  let category = "unstarted";
  if (masteryScore >= 80) category = "strong";
  else if (masteryScore >= 50) category = "medium";
  else if (masteryScore > 0) category = "weak";

  const diffStars = selectedNodeData 
    ? "🌟".repeat(selectedNodeData.difficulty) + "⭐".repeat(5 - selectedNodeData.difficulty)
    : "";

  // Recommendation calculations
  let recSignal = "No student attempt data. Complete the prerequisite concepts first.";
  let recClass = "recommendation-box";
  
  if (topicDetails) {
    let hasPersistentMisconception = false;
    if (topicDetails.error_types) {
      for (const count of Object.values(topicDetails.error_types)) {
        if (count >= 3) hasPersistentMisconception = true;
      }
    }

    if (masteryScore < 50) {
      if (hasPersistentMisconception) {
        recSignal = `⚠️ URGENT REVISION: Repeated misconceptions detected! Review fundamental equations and error profiles.`;
        recClass = "recommendation-box revision-needed";
      } else {
        recSignal = "Needs foundational review and basic practice questions.";
        recClass = "recommendation-box";
      }
    } else if (masteryScore < 80) {
      recSignal = "Needs moderate advanced practice questions to reach full concept mastery.";
      recClass = "recommendation-box";
    } else {
      recSignal = "Topic mastered. Highly prepared to unlock subsequent concepts.";
      recClass = "recommendation-box";
    }
  }

  // Get unlocks (successors)
  const unlocks = graphData 
    ? graphData.edges.filter(edge => edge.from === selectedNodeId).map(edge => edge.to)
    : [];

  return (
    <div className="space-y-6">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Knowledge Graph & Student Analytics</h2>
          <p>Observe concept hierarchies and misconceptions in real-time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Graph Canvas */}
        <div className="card graph-card xl:col-span-2">
          <div className="card-header">
            <h3>Interactive Graph Canvas</h3>
            <span className="badge">Drag to Pan / Scroll to Zoom</span>
          </div>
          <div className="graph-wrapper">
            <ConceptGraph />
          </div>
        </div>

        {/* Concept details */}
        <div className="card detail-card">
          <div className="card-header">
            <h3>Concept Insights</h3>
            <span className={`badge detail-status legend-color ${category}`}>
              {selectedNodeId ? category.toUpperCase() : 'Select a Node'}
            </span>
          </div>

          {!selectedNodeData ? (
            <div className="detail-placeholder">
              <span className="placeholder-icon">📐</span>
              <p>Click on any concept node in the knowledge graph to view its detailed mastery, prerequisites, unlocked topics, and adaptive recommendations.</p>
            </div>
          ) : (
            <div className="detail-content text-left">
              <h2 className="concept-title">{selectedNodeData.display_name}</h2>
              <span className="difficulty-rating">{diffStars} (Difficulty: {selectedNodeData.difficulty}/5)</span>
              <p className="concept-desc">{selectedNodeData.description}</p>

              <div className="insight-section">
                <h4>Student Mastery Metrics</h4>
                <div className="progress-bar-container">
                  <div className={`progress-bar ${category}`} style={{ width: `${masteryScore}%` }} />
                  <span className="progress-text">{masteryScore}%</span>
                </div>

                <div className="metrics-grid">
                  <div className="metric-item">
                    <span className="metric-label">Accuracy</span>
                    <span className="metric-value">
                      {topicDetails ? `${topicDetails.correct_answers}/${topicDetails.total_attempts}` : '0/0'}
                    </span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Hints Used</span>
                    <span className="metric-value">{topicDetails ? topicDetails.hints_used : 0}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Time Spent</span>
                    <span className="metric-value">{topicDetails ? `${topicDetails.total_time_taken}s` : '0s'}</span>
                  </div>
                </div>
              </div>

              {topicDetails && topicDetails.error_types && Object.keys(topicDetails.error_types).length > 0 && (
                <div className="insight-section">
                  <h4>Error Profile & Misconceptions</h4>
                  <ul className="error-list">
                    {Object.entries(topicDetails.error_types).map(([err, count]) => (
                      <li key={err}>
                        <span>{err}</span>
                        <span className="error-count">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="insight-section">
                <h4>Adaptive Recommendations</h4>
                <div className={recClass}>{recSignal}</div>
              </div>

              <div className="insight-section relationship-section">
                <div className="rel-box">
                  <h5>Required Prerequisites</h5>
                  <div className="rel-list">
                    {selectedNodeData.prerequisites.length === 0 ? (
                      <em className="text-theme-muted text-[10px]">None</em>
                    ) : (
                      selectedNodeData.prerequisites.map(prereqId => {
                        const display = graphData?.nodes.find(n => n.id === prereqId)?.display_name || prereqId;
                        return (
                          <span 
                            key={prereqId} 
                            onClick={() => setSelectedNodeId(prereqId)}
                            className="rel-badge prereq-badge"
                          >
                            {display}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rel-box">
                  <h5>Unlocks Next</h5>
                  <div className="rel-list">
                    {unlocks.length === 0 ? (
                      <em className="text-theme-muted text-[10px]">None</em>
                    ) : (
                      unlocks.map(unlockId => {
                        const display = graphData?.nodes.find(n => n.id === unlockId)?.display_name || unlockId;
                        return (
                          <span 
                            key={unlockId} 
                            onClick={() => setSelectedNodeId(unlockId)}
                            className="rel-badge unlocks-badge"
                          >
                            {display}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulator Card */}
      <div className="card max-w-xl">
        <div className="card-header">
          <h3>Practice Quiz Simulator</h3>
          <span className="badge">Update Mastery Status</span>
        </div>
        
        <form onSubmit={handleSubmitAttempt} className="simulator-form text-left">
          <div className="form-group">
            <label htmlFor="sim-topic">Concept Topic</label>
            <select 
              id="sim-topic" 
              value={simTopic} 
              onChange={e => setSimTopic(e.target.value)}
              className="form-control" 
              required
            >
              {graphData?.nodes.map(node => (
                <option key={node.id} value={node.id}>{node.display_name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="sim-correct">Question Result</label>
              <select 
                id="sim-correct" 
                value={simResult} 
                onChange={e => setSimResult(e.target.value)}
                className="form-control"
              >
                <option value="correct">✅ Correct Answer</option>
                <option value="incorrect">❌ Incorrect Answer</option>
              </select>
            </div>
            {simResult === 'incorrect' && (
              <div className="form-group">
                <label htmlFor="sim-error-type">Misconception / Error Type</label>
                <select 
                  id="sim-error-type" 
                  value={simErrorType}
                  onChange={e => setSimErrorType(e.target.value)}
                  className="form-control"
                >
                  {(ERROR_TYPES[currentCourse] || []).map(err => (
                    <option key={err} value={err}>{err}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="sim-hints">Hints Used (0-5)</label>
              <input 
                type="number" 
                id="sim-hints" 
                min="0" 
                max="5" 
                value={simHints}
                onChange={e => setSimHints(Number(e.target.value))}
                className="form-control" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="sim-time">Time Taken (seconds)</label>
              <input 
                type="number" 
                id="sim-time" 
                min="5" 
                max="300" 
                value={simTime}
                onChange={e => setSimTime(Number(e.target.value))}
                className="form-control" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={simulating}
            className="btn btn-primary"
          >
            {simulating ? 'Recording Attempt...' : 'Record Practice Attempt'}
          </button>
        </form>
      </div>
    </div>
  );
};
