import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FILE_LIMITS, validateFiles, previewYouTube, YouTubePreview } from '../../api/sources';

type Tab = 'upload' | 'website' | 'youtube' | 'paste';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onWebsite: (url: string) => Promise<void>;
  onYouTube: (url: string) => Promise<void>;
  onPaste: (title: string, content: string) => Promise<void>;
  uploading: boolean;
}

const DRAFT_KEY = 'knowlify_paste_draft';

export const AddSourcesModal: React.FC<Props> = ({
  open,
  onClose,
  onUpload,
  onWebsite,
  onYouTube,
  onPaste,
  uploading,
}) => {
  const [tab, setTab] = useState<Tab>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubePreview, setYoutubePreview] = useState<YouTubePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState(
    () => localStorage.getItem(DRAFT_KEY) || ''
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== 'youtube') return;
    const url = youtubeUrl.trim();
    if (!url.includes('youtube') && !url.includes('youtu.be')) {
      setYoutubePreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const preview = await previewYouTube(url);
        setYoutubePreview(preview);
      } catch {
        setYoutubePreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [youtubeUrl, tab]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const validationError = validateFiles(list);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      try {
        await onUpload(list);
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      }
    },
    [onUpload, onClose]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteTitle.trim()) {
      setError('Please enter a source title.');
      return;
    }
    if (!pasteContent.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    setError(null);
    try {
      await onPaste(pasteTitle, pasteContent);
      localStorage.removeItem(DRAFT_KEY);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save note');
    }
  };

  const handleWebsiteSubmit = async () => {
    if (!websiteUrl.trim()) {
      setError('Please enter a URL.');
      return;
    }
    setError(null);
    try {
      await onWebsite(websiteUrl.trim());
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  };

  const handleYouTubeSubmit = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL.');
      return;
    }
    setError(null);
    try {
      await onYouTube(youtubeUrl.trim());
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-sources-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Knowledge Sources</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          {(['upload', 'website', 'youtube', 'paste'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`modal-tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); setError(null); }}
            >
              {t === 'upload' && 'Upload Files'}
              {t === 'website' && 'Website'}
              {t === 'youtube' && 'YouTube'}
              {t === 'paste' && 'Paste Text'}
            </button>
          ))}
        </div>

        {error && <div className="modal-error">{error}</div>}

        {tab === 'upload' && (
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div className="drop-zone-icon">📚</div>
            <p className="drop-zone-title">Drag & drop files here</p>
            <p className="drop-zone-sub">or click to browse</p>
            <div className="drop-zone-limits">
              <span>PDF · DOCX · PPTX · TXT · MD</span>
              <span>Max 50 MB per file · Up to {FILE_LIMITS.maxFiles} files · 500 MB total</span>
            </div>
          </div>
        )}

        {tab === 'website' && (
          <div className="modal-form">
            <label>Website URL</label>
            <input
              type="url"
              placeholder="https://example.com/article"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <p className="modal-hint">Import articles and webpages. Main content is extracted automatically.</p>
            <button className="btn btn-primary" onClick={handleWebsiteSubmit} disabled={uploading}>
              {uploading ? 'Importing...' : 'Import Website'}
            </button>
          </div>
        )}

        {tab === 'youtube' && (
          <div className="modal-form">
            <label>YouTube URL</label>
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=xxxx"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            {previewLoading && <p className="modal-hint">Loading preview...</p>}
            {youtubePreview && (
              <div className="youtube-preview-card">
                <img src={youtubePreview.thumbnail} alt="" className="youtube-preview-thumb" />
                <div>
                  <p className="youtube-preview-title">{youtubePreview.title}</p>
                  {youtubePreview.channel && (
                    <p className="youtube-preview-channel">{youtubePreview.channel}</p>
                  )}
                </div>
              </div>
            )}
            <p className="modal-hint">Imports video transcripts (captions or auto-generated subtitles).</p>
            <button className="btn btn-primary" onClick={handleYouTubeSubmit} disabled={uploading || !youtubeUrl.trim()}>
              {uploading ? 'Importing...' : 'Import Video'}
            </button>
          </div>
        )}

        {tab === 'paste' && (
          <div className="modal-form">
            <label>Source Title</label>
            <input
              type="text"
              placeholder="Research notes, summary, or topic"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
            <label>Content</label>
            <textarea
              className="paste-editor"
              placeholder="Paste your research notes, summaries, or raw text..."
              value={pasteContent}
              onChange={(e) => {
                setPasteContent(e.target.value);
                localStorage.setItem(DRAFT_KEY, e.target.value);
              }}
              rows={10}
            />
            <div className="paste-footer">
              <span className="char-count">{pasteContent.length.toLocaleString()} characters</span>
              <span className="draft-hint">Draft auto-saved</span>
            </div>
            <button className="btn btn-primary" onClick={handlePasteSubmit} disabled={uploading}>
              {uploading ? 'Processing...' : 'Add to Knowledge Base'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
