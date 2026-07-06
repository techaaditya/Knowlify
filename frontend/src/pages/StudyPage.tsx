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
}

export const StudyPage: React.FC<StudyPageProps> = ({ initialMode, initialMessage, onClearInitPayload }) => {
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
          <h2>Chat with Your Tutor</h2>
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
            Go to <strong>Sources</strong> and select the documents, websites, or notes
            you want to chat with.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Concept context bar (optional — chat works without a node too) */}
          {selectedNodeData && (
            <div style={{
              padding: '10px 16px',
              background: 'var(--swatch-2)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: 12, fontSize: 12,
            }}>
              <span style={{ fontSize: 18 }}>🕸️</span>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedNodeData.display_name}
                </span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                  {selectedNodeData.description.slice(0, 100)}
                  {selectedNodeData.description.length > 100 ? '…' : ''}
                </span>
              </div>
            </div>
          )}

          <div style={{ height: 640 }}>
            <ChatWindow
              concept={selectedNodeData?.display_name}
              conceptId={selectedNodeId || undefined}
              workspaceId={workspace?.id}
              studentId={studentId}
              sourceIds={selectedSourceIds}
              initialMode={initialMode}
              initialMessage={initialMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
