import React, { useState } from 'react';
import { Source } from '../../api/sources';
import { ProcessingPipeline } from './ProcessingPipeline';

const TYPE_ICONS: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  pptx: '📊',
  txt: '📃',
  md: '📋',
  website: '🌐',
  youtube: '▶️',
  paste: '✏️',
};

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'PowerPoint',
  txt: 'Text',
  md: 'Markdown',
  website: 'Website',
  youtube: 'YouTube',
  paste: 'Note',
};

interface Props {
  source: Source;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onReprocess: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onOpen: (source: Source) => void;
}

export const SourceCard: React.FC<Props> = ({
  source,
  selected,
  onToggleSelect,
  onDelete,
  onReprocess,
  onRename,
  onOpen,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(source.source_name);

  const statusClass =
    source.processing_status === 'completed'
      ? 'status-completed'
      : source.processing_status === 'failed'
        ? 'status-failed'
        : source.processing_status === 'processing'
          ? 'status-processing'
          : 'status-pending';

  const handleRename = () => {
    if (newName.trim() && newName !== source.source_name) {
      onRename(source.id, newName.trim());
    }
    setRenaming(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className={`source-card ${statusClass} ${selected ? 'selected' : ''}`}>
      <div className="source-card-header">
        {source.processing_status === 'completed' && (
          <label className="source-select-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(source.id)}
            />
          </label>
        )}
        <div className="source-card-icon">{TYPE_ICONS[source.source_type] || '📁'}</div>
        <div className="source-card-title-block">
          {renaming ? (
            <input
              className="source-rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          ) : (
            <h4 className="source-card-title" onClick={() => onOpen(source)}>
              {source.source_name}
            </h4>
          )}
          <div className="source-card-meta">
            <span>{TYPE_LABELS[source.source_type] || source.source_type}</span>
            <span>·</span>
            <span>{formatDate(source.created_at)}</span>
          </div>
        </div>
        <span className={`source-status-badge ${statusClass}`}>
          {source.processing_status}
        </span>
      </div>

      {(source.processing_status === 'processing' || source.processing_status === 'pending') && (
        <ProcessingPipeline
          currentStage={source.processing_stage}
          progress={source.progress_percent}
          status={source.processing_status}
        />
      )}

      {source.processing_status === 'failed' && source.error_message && (
        <p className="source-error-msg">{source.error_message}</p>
      )}

      {source.processing_status === 'completed' && (
        <div className="source-metrics">
          <div className="source-metric">
            <span className="source-metric-value">{source.chunk_count}</span>
            <span className="source-metric-label">Chunks</span>
          </div>
          <div className="source-metric">
            <span className="source-metric-value">{source.entity_count}</span>
            <span className="source-metric-label">Entities</span>
          </div>
          <div className="source-metric">
            <span className="source-metric-value">{source.relationship_count}</span>
            <span className="source-metric-label">Relations</span>
          </div>
        </div>
      )}

      {source.ai_summary && source.processing_status === 'completed' && (
        <p className="source-summary">{source.ai_summary}</p>
      )}

      {source.key_topics && source.key_topics.length > 0 && (
        <div className="source-topics">
          {source.key_topics.slice(0, 4).map((t) => (
            <span key={t} className="source-topic-tag">{t}</span>
          ))}
        </div>
      )}

      <div className="source-card-actions">
        <button className="btn-ghost" onClick={() => onOpen(source)}>Open</button>
        <button className="btn-ghost" onClick={() => setRenaming(true)}>Rename</button>
        <button className="btn-ghost" onClick={() => onReprocess(source.id)}>Reprocess</button>
        <button className="btn-ghost danger" onClick={() => onDelete(source.id)}>Delete</button>
      </div>
    </div>
  );
};
