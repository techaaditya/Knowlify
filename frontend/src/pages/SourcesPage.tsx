import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSourcesStore } from '../store/sourcesStore';
import { AddSourcesModal } from '../components/Sources/AddSourcesModal';
import { SourceCard } from '../components/Sources/SourceCard';
import { SourcesEmptyState } from '../components/Sources/SourcesEmptyState';
import { Source } from '../api/sources';

interface Props {
  openModalOnMount?: boolean;
}

export const SourcesPage: React.FC<Props> = ({ openModalOnMount }) => {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const refreshAll = useWorkspaceStore((s) => s.refreshAll);
  const sources = useSourcesStore((s) => s.sources);
  const loading = useSourcesStore((s) => s.loading);
  const uploading = useSourcesStore((s) => s.uploading);
  const search = useSourcesStore((s) => s.search);
  const filter = useSourcesStore((s) => s.filter);
  const sort = useSourcesStore((s) => s.sort);
  const setSearch = useSourcesStore((s) => s.setSearch);
  const setFilter = useSourcesStore((s) => s.setFilter);
  const setSort = useSourcesStore((s) => s.setSort);
  const fetchSources = useSourcesStore((s) => s.fetchSources);
  const uploadFiles = useSourcesStore((s) => s.uploadFiles);
  const pasteText = useSourcesStore((s) => s.pasteText);
  const addWebsite = useSourcesStore((s) => s.addWebsite);
  const addYouTube = useSourcesStore((s) => s.addYouTube);
  const removeSource = useSourcesStore((s) => s.removeSource);
  const retrySource = useSourcesStore((s) => s.retrySource);
  const renameSource = useSourcesStore((s) => s.renameSource);
  const selectedSourceIds = useSourcesStore((s) => s.selectedSourceIds);
  const toggleSourceSelection = useSourcesStore((s) => s.toggleSourceSelection);
  const selectAllCompleted = useSourcesStore((s) => s.selectAllCompleted);

  const [modalOpen, setModalOpen] = useState(openModalOnMount ?? false);

  useEffect(() => {
    if (openModalOnMount) setModalOpen(true);
  }, [openModalOnMount]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  useEffect(() => {
    if (workspace?.id) {
      fetchSources(workspace.id);
    }
  }, [workspace?.id, search, filter, sort, fetchSources]);

  useEffect(() => {
    const hasProcessing = sources.some(
      (s) => s.processing_status === 'processing' || s.processing_status === 'pending'
    );
    if (!hasProcessing || !workspace?.id) return;

    const interval = setInterval(() => {
      fetchSources(workspace.id);
      refreshAll();
    }, 2500);
    return () => clearInterval(interval);
  }, [sources, workspace?.id, fetchSources, refreshAll]);

  const handleUpload = async (files: File[]) => {
    if (!workspace) return;
    await uploadFiles(workspace.id, files);
    await refreshAll();
    if (workspace.id) fetchSources(workspace.id);
  };

  const handleDrop = async (fileList: FileList) => {
    setModalOpen(true);
    await handleUpload(Array.from(fileList));
  };

  const handleAction = async (action: () => Promise<void>) => {
    await action();
    await refreshAll();
    if (workspace?.id) fetchSources(workspace.id);
  };

  return (
    <div className="sources-page">
      <div className="sources-toolbar">
        <div className="sources-search">
          <input
            type="search"
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sources-filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="pdf">PDFs</option>
            <option value="documents">Documents</option>
            <option value="websites">Websites</option>
            <option value="youtube">YouTube</option>
            <option value="notes">Notes</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="largest">Largest</option>
            <option value="most_connected">Most Connected</option>
          </select>
        </div>
        <button className="btn btn-secondary" onClick={selectAllCompleted}>
          Select All
        </button>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          + Add Sources
        </button>
      </div>

      {loading && sources.length === 0 ? (
        <div className="sources-loading">Loading knowledge sources...</div>
      ) : sources.length === 0 && !search && filter === 'all' ? (
        <SourcesEmptyState
          onAddSources={() => setModalOpen(true)}
          onDrop={handleDrop}
        />
      ) : (
        <div className="sources-grid">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              selected={selectedSourceIds.includes(source.id)}
              onToggleSelect={toggleSourceSelection}
              onOpen={setSelectedSource}
              onDelete={(id) => handleAction(() => removeSource(id))}
              onReprocess={(id) => handleAction(() => retrySource(id))}
              onRename={(id, name) => handleAction(() => renameSource(id, name))}
            />
          ))}
          {sources.length === 0 && (
            <p className="sources-no-results">No sources match your filters.</p>
          )}
        </div>
      )}

      <AddSourcesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpload={handleUpload}
        onWebsite={(url) => workspace ? handleAction(() => addWebsite(workspace.id, url)) : Promise.resolve()}
        onYouTube={(url) => workspace ? handleAction(() => addYouTube(workspace.id, url)) : Promise.resolve()}
        onPaste={(title, content) =>
          workspace ? handleAction(() => pasteText(workspace.id, title, content)) : Promise.resolve()
        }
        uploading={uploading}
      />

      {selectedSource && (
        <div className="modal-overlay" onClick={() => setSelectedSource(null)}>
          <div className="modal-content source-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedSource.source_name}</h2>
              <button className="modal-close" onClick={() => setSelectedSource(null)}>×</button>
            </div>
            {selectedSource.ai_summary && (
              <div className="source-detail-section">
                <h4>AI Summary</h4>
                <p>{selectedSource.ai_summary}</p>
              </div>
            )}
            {selectedSource.key_topics && selectedSource.key_topics.length > 0 && (
              <div className="source-detail-section">
                <h4>Key Topics</h4>
                <div className="source-topics">
                  {selectedSource.key_topics.map((t) => (
                    <span key={t} className="source-topic-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedSource.suggested_questions && (
              <div className="source-detail-section">
                <h4>Suggested Questions</h4>
                <ul className="suggested-questions">
                  {selectedSource.suggested_questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedSource.relationship_insights && selectedSource.relationship_insights.length > 0 && (
              <div className="source-detail-section">
                <h4>Relationship Insights</h4>
                <ul>
                  {selectedSource.relationship_insights.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
