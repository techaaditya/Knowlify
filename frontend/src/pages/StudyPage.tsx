import React from 'react';
import { useStudyStore } from '../store/studyStore';
import { useSourcesStore } from '../store/sourcesStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useUserStore } from '../store/userStore';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';

interface StudyPageProps {
  initialMode?: string;
  initialMessage?: string;
  onClearInitPayload?: () => void;
  onGenerateAction?: (mode: 'quiz' | 'flashcards' | 'notes' | 'study_guide', conceptId?: string | null) => void;
}

export const StudyPage: React.FC<StudyPageProps> = ({ initialMode, initialMessage, onClearInitPayload, onGenerateAction }) => {
  const selectedNodeData = useStudyStore((state) => state.selectedNodeData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const selectedSources = useSourcesStore((s) => s.getSelectedSources());
  const selectedSourceIds = useSourcesStore((s) => s.selectedSourceIds);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const studentId = useUserStore((s) => s.studentId);

  React.useEffect(() => {
    if ((initialMode || initialMessage) && onClearInitPayload) {
      onClearInitPayload();
    }
  }, [initialMode, initialMessage, onClearInitPayload]);

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />

      <div className="dashboard-header">
        <div className="header-title">
          <h2>AI Tutor</h2>
          <p>
            {selectedNodeData
              ? `Focused on: ${selectedNodeData.display_name}`
              : 'Ask anything about your uploaded sources'}
          </p>
        </div>
      </div>

      {selectedSources.length === 0 ? (
        <div className="card items-center justify-center p-12 text-center">
          <span className="text-3xl mb-3">💬</span>
          <h3 className="font-bold text-sm mb-1">No Sources Selected</h3>
          <p className="text-xs text-theme-muted max-w-[320px]">
            Go to <strong>Library</strong> and select the documents, websites, or notes
            you want to chat with.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Concept context bar (optional — chat works without a node too) */}
          {selectedNodeData && (
            <div className="flex items-center gap-3 text-xs px-4 py-2.5 rounded-lg border border-theme-border bg-theme-ivory">
              <span className="text-lg">🕸️</span>
              <div>
                <span className="font-bold text-theme-text">
                  {selectedNodeData.display_name}
                </span>
                <span className="text-theme-muted ml-2">
                  {selectedNodeData.description.slice(0, 100)}
                  {selectedNodeData.description.length > 100 ? '…' : ''}
                </span>
              </div>
            </div>
          )}

          <div className="h-[640px]">
            <ChatWindow
              concept={selectedNodeData?.display_name}
              conceptId={selectedNodeId || undefined}
              workspaceId={workspace?.id}
              studentId={studentId}
              sourceIds={selectedSourceIds}
              initialMode={initialMode}
              initialMessage={initialMessage}
              onGenerateAction={onGenerateAction}
            />
          </div>
        </div>
      )}
    </div>
  );
};
