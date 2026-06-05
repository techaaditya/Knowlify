import React from 'react';
import { useStudyStore } from '../store/studyStore';
import { useSourcesStore } from '../store/sourcesStore';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { FlashcardDeck } from '../components/Flashcards/FlashcardDeck';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';

export const StudyPage: React.FC = () => {
  const selectedNodeData = useStudyStore((state) => state.selectedNodeData);
  const selectedSources = useSourcesStore((s) => s.getSelectedSources());

  const sourceContext = selectedSources.map((s) => ({
    id: s.id,
    name: s.source_name,
    summary: s.ai_summary,
    topics: s.key_topics || [],
  }));

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />

      <div className="dashboard-header">
        <div className="header-title">
          <h2>Chat</h2>
          <p>Ask questions grounded in your selected knowledge sources</p>
        </div>
      </div>

      {selectedSources.length === 0 ? (
        <div className="card items-center justify-center p-12 text-center">
          <span className="text-3xl mb-3">💬</span>
          <h3 className="font-bold text-sm mb-1">No Sources Selected</h3>
          <p className="text-xs text-theme-muted max-w-[320px]">
            Go to <strong>Sources</strong> and select the documents, websites, or notes you want to chat with.
          </p>
        </div>
      ) : !selectedNodeData ? (
        <div className="card items-center justify-center p-12 text-center">
          <span className="text-3xl mb-3">🕸️</span>
          <h3 className="font-bold text-sm mb-1">Select a Concept</h3>
          <p className="text-xs text-theme-muted max-w-[320px]">
            Open the <strong>Knowledge Graph</strong> and click a concept node to start a focused conversation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Socratic Chat</h3>
            <ChatWindow concept={selectedNodeData.display_name} sources={sourceContext} />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Flashcards</h3>
            <FlashcardDeck
              concept={selectedNodeData.display_name}
              description={selectedNodeData.description}
            />
          </div>
        </div>
      )}
    </div>
  );
};
