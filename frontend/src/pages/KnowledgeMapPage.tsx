import React, { useRef, useState } from 'react';
import { useStudyStore } from '../store/studyStore';
import { useSourcesStore } from '../store/sourcesStore';
import { ConceptGraph, defaultGraphFilters, type ConceptGraphHandle, type GraphFilterState } from '../components/KnowledgeMap/ConceptGraph';
import { ConceptSidePanel } from '../components/KnowledgeMap/ConceptSidePanel';
import { GraphChrome } from '../components/KnowledgeMap/GraphChrome';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import '../components/KnowledgeMap/knowledgeMap.css';

export const KnowledgeMapPage: React.FC = () => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeData = useStudyStore((state) => state.selectedNodeData);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((s) => s.getSelectedSources());

  const graphRef = useRef<ConceptGraphHandle>(null);
  const [filters, setFilters] = useState<GraphFilterState>(defaultGraphFilters());

  return (
    <div className="kg-shell">
      <header className="kg-header">
        <div className="kg-header-title">
          <h2>Knowledge Graph</h2>
          <p>Your concepts, mastery, and what to learn next — visualized live</p>
        </div>
        <div className="kg-header-sources">
          <SelectedSourcesBar />
        </div>
      </header>

      {selectedSources.length === 0 ? (
        <div className="kg-empty">
          <span className="kg-empty-icon" aria-hidden>🕸️</span>
          <h3>No sources selected</h3>
          <p>Select processed sources from the Sources page to visualize their knowledge graph.</p>
        </div>
      ) : (
        <div className="kg-body">
          <div className="kg-canvas-area">
            <ConceptGraph ref={graphRef} filters={filters} />
            {graphData && graphData.nodes.length > 0 && (
              <GraphChrome
                filters={filters}
                onFiltersChange={setFilters}
                onZoomIn={() => graphRef.current?.zoomIn()}
                onZoomOut={() => graphRef.current?.zoomOut()}
                onFit={() => graphRef.current?.fit()}
              />
            )}
          </div>

          <ConceptSidePanel
            selectedNode={selectedNodeData}
            allNodes={graphData?.nodes ?? []}
            edges={graphData?.edges ?? []}
            onSelectNode={setSelectedNodeId}
          />
        </div>
      )}
    </div>
  );
};

export default KnowledgeMapPage;
