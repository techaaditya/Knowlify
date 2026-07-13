import React, { useState } from 'react';
import {
  Download,
  Maximize,
  Minimize,
  RotateCcw,
  Sparkles,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface Props {
  title: string;
  presenting: boolean;
  onTogglePresent: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onExport: (format: 'png' | 'svg') => void;
  onNewSession: () => void;
  onFinishSession: () => void;
  hasHistory: boolean;
}

export const CanvasToolbar: React.FC<Props> = ({
  title,
  presenting,
  onTogglePresent,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onExport,
  onNewSession,
  onFinishSession,
  hasHistory,
}) => {
  const [exportOpen, setExportOpen] = useState(false);

  if (presenting) {
    return (
      <button type="button" className="ai-canvas-present-exit" onClick={onTogglePresent} aria-label="Exit presentation mode">
        <Minimize size={15} /> Exit presentation
      </button>
    );
  }

  return (
    <header className="ai-canvas-toolbar">
      <div className="ai-canvas-toolbar-title">
        <Sparkles size={16} aria-hidden />
        <h1>{title}</h1>
      </div>

      <div className="ai-canvas-toolbar-controls">
        <div className="ai-canvas-zoom-group">
          <button type="button" onClick={onZoomOut} aria-label="Zoom out"><ZoomOut size={15} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={onZoomIn} aria-label="Zoom in"><ZoomIn size={15} /></button>
          <button type="button" onClick={onResetZoom} aria-label="Reset zoom"><RotateCcw size={13} /></button>
        </div>

        <div className="ai-canvas-export-wrap">
          <button type="button" className="ai-canvas-toolbar-btn" onClick={() => setExportOpen((v) => !v)} aria-label="Export canvas">
            <Download size={15} /> Export
          </button>
          {exportOpen && (
            <div className="ai-canvas-export-menu">
              <button type="button" onClick={() => { onExport('png'); setExportOpen(false); }}>PNG image</button>
              <button type="button" onClick={() => { onExport('svg'); setExportOpen(false); }}>SVG image</button>
            </div>
          )}
        </div>

        <button type="button" className="ai-canvas-toolbar-btn" onClick={onTogglePresent} aria-label="Presentation mode">
          <Square size={14} /> Present
        </button>

        {hasHistory && (
          <button type="button" className="ai-canvas-toolbar-btn" onClick={onFinishSession}>
            Finish session
          </button>
        )}

        <button type="button" className="ai-canvas-toolbar-btn" onClick={onNewSession} aria-label="Start a new canvas">
          <Maximize size={14} /> New
        </button>
      </div>
    </header>
  );
};

export default CanvasToolbar;
