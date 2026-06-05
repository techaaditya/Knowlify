import React from 'react';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useSourcesStore } from '../store/sourcesStore';
import { ConceptGraph } from '../components/KnowledgeMap/ConceptGraph';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';

export const KnowledgeMapPage: React.FC = () => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const selectedNodeData = useStudyStore((state) => state.selectedNodeData);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((s) => s.getSelectedSources());

  const studentData = useUserStore((state) => state.studentData);

  const topicDetails = studentData && selectedNodeId ? studentData.topics[selectedNodeId] : null;
  const masteryScore = topicDetails ? topicDetails.mastery_score : 0;

  let category = 'unstarted';
  if (masteryScore >= 80) category = 'strong';
  else if (masteryScore >= 50) category = 'medium';
  else if (masteryScore > 0) category = 'weak';

  const diffStars = selectedNodeData
    ? '🌟'.repeat(selectedNodeData.difficulty) + '⭐'.repeat(5 - selectedNodeData.difficulty)
    : '';

  let recSignal = 'Select a concept node to view adaptive recommendations.';
  let recClass = 'recommendation-box';

  if (topicDetails) {
    let hasPersistentMisconception = false;
    if (topicDetails.error_types) {
      for (const count of Object.values(topicDetails.error_types)) {
        if (count >= 3) hasPersistentMisconception = true;
      }
    }
    if (masteryScore < 50) {
      recSignal = hasPersistentMisconception
        ? 'Repeated misconceptions detected. Review fundamentals before advancing.'
        : 'Needs foundational review and basic practice.';
      recClass = hasPersistentMisconception ? 'recommendation-box revision-needed' : 'recommendation-box';
    } else if (masteryScore < 80) {
      recSignal = 'Needs moderate practice to reach full mastery.';
    } else {
      recSignal = 'Topic mastered. Ready to unlock subsequent concepts.';
    }
  }

  const unlocks = graphData
    ? graphData.edges.filter((edge) => edge.from === selectedNodeId).map((edge) => edge.to)
    : [];

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />

      <div className="dashboard-header">
        <div className="header-title">
          <h2>Knowledge Graph</h2>
          <p>Explore concept relationships from your selected sources</p>
        </div>
      </div>

      {selectedSources.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-theme-muted text-sm">
            Select sources from the Sources page to visualize their knowledge graph.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card graph-card xl:col-span-2">
            <div className="card-header">
              <h3>Interactive Graph</h3>
              <span className="badge">Drag to Pan / Scroll to Zoom</span>
            </div>
            <div className="graph-wrapper">
              <ConceptGraph />
            </div>
          </div>

          <div className="card detail-card">
            <div className="card-header">
              <h3>Concept Details</h3>
              <span className={`badge detail-status legend-color ${category}`}>
                {selectedNodeId ? category.toUpperCase() : 'SELECT NODE'}
              </span>
            </div>

            {!selectedNodeData ? (
              <div className="detail-placeholder">
                <span className="placeholder-icon">🕸️</span>
                <p>Click any node to view mastery, prerequisites, and recommendations from your active sources.</p>
              </div>
            ) : (
              <div className="detail-content text-left">
                <h2 className="concept-title">{selectedNodeData.display_name}</h2>
                <span className="difficulty-rating">{diffStars} (Difficulty: {selectedNodeData.difficulty}/5)</span>
                <p className="concept-desc">{selectedNodeData.description}</p>

                <div className="insight-section">
                  <h4>Mastery</h4>
                  <div className="progress-bar-container">
                    <div className={`progress-bar ${category}`} style={{ width: `${masteryScore}%` }} />
                    <span className="progress-text">{masteryScore}%</span>
                  </div>
                </div>

                <div className="insight-section">
                  <h4>Recommendation</h4>
                  <div className={recClass}>{recSignal}</div>
                </div>

                <div className="insight-section relationship-section">
                  <div className="rel-box">
                    <h5>Prerequisites</h5>
                    <div className="rel-list">
                      {selectedNodeData.prerequisites.length === 0 ? (
                        <em className="text-theme-muted text-[10px]">None</em>
                      ) : (
                        selectedNodeData.prerequisites.map((prereqId) => {
                          const display = graphData?.nodes.find((n) => n.id === prereqId)?.display_name || prereqId;
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
                    <h5>Unlocks</h5>
                    <div className="rel-list">
                      {unlocks.length === 0 ? (
                        <em className="text-theme-muted text-[10px]">None</em>
                      ) : (
                        unlocks.map((unlockId) => {
                          const display = graphData?.nodes.find((n) => n.id === unlockId)?.display_name || unlockId;
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
      )}
    </div>
  );
};
