import React from 'react';
import { Workspace } from '../../api/sources';

interface Props {
  workspace: Workspace | null;
  onAddSources: () => void;
  onChat: () => void;
}

export const WorkspaceHeader: React.FC<Props> = ({ workspace, onAddSources, onChat }) => {
  const lastUpdated = workspace?.updated_at
    ? new Date(workspace.updated_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <header className="workspace-header">
      <div className="workspace-header-info">
        <h2 className="workspace-name">{workspace?.name || 'My Knowledge Base'}</h2>
        <div className="workspace-stats-row">
          <span><strong>{workspace?.total_sources ?? 0}</strong> Sources</span>
          <span><strong>{workspace?.total_chunks ?? 0}</strong> Chunks</span>
          <span><strong>{workspace?.total_entities ?? 0}</strong> Entities</span>
          <span><strong>{workspace?.total_relationships ?? 0}</strong> Relationships</span>
          <span className="workspace-updated">Updated {lastUpdated}</span>
        </div>
      </div>
      <div className="workspace-header-actions">
        <button className="btn btn-secondary" onClick={onAddSources}>
          + Add Sources
        </button>
        <button className="btn btn-primary" onClick={onChat}>
          Chat with Knowledge Base
        </button>
      </div>
    </header>
  );
};
