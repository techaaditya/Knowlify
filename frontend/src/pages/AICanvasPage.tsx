import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { CanvasStage } from '../components/AICanvas/CanvasStage';
import { CanvasToolbar } from '../components/AICanvas/CanvasToolbar';
import { CanvasSummaryCard } from '../components/AICanvas/CanvasSummaryCard';
import { useCanvasSessionStore } from '../components/AICanvas/canvasSessionStore';
import { useCanvasLaunchStore } from '../components/AICanvas/canvasLaunchStore';
import { humanizeConcept } from '../companion/brain';
import '../components/AICanvas/aiCanvas.css';

const SUGGESTIONS = [
  'Explain Binary Search',
  'Explain Linear Regression',
  'Explain a SQL JOIN',
  'Explain Neural Networks',
];

export const AICanvasPage: React.FC = () => {
  const scene = useCanvasSessionStore((s) => s.scene);
  const loading = useCanvasSessionStore((s) => s.loading);
  const history = useCanvasSessionStore((s) => s.history);
  const requestScene = useCanvasSessionStore((s) => s.requestScene);
  const resetSession = useCanvasSessionStore((s) => s.resetSession);

  const launchToken = useCanvasLaunchStore((s) => s.requestToken);
  const launchConceptId = useCanvasLaunchStore((s) => s.conceptId);
  const launchConceptName = useCanvasLaunchStore((s) => s.conceptName);
  const launchPrompt = useCanvasLaunchStore((s) => s.prompt);

  const [input, setInput] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastHandledToken = useRef(0);

  // A launch from the Knowledge Graph / Quiz / a recommendation hands us a
  // concept — start teaching it immediately.
  useEffect(() => {
    if (launchToken === 0 || launchToken === lastHandledToken.current) return;
    lastHandledToken.current = launchToken;
    const conceptName = launchConceptName || (launchConceptId ? humanizeConcept(launchConceptId) : null);
    const prompt = launchPrompt || (conceptName ? `Explain ${conceptName}` : null);
    if (prompt) {
      requestScene(prompt, { conceptId: launchConceptId, conceptName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchToken]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    requestScene(text, { conceptId: launchConceptId });
  };

  const handleExport = async (format: 'png' | 'svg') => {
    if (!stageRef.current) return;
    try {
      const dataUrl = format === 'png' ? await toPng(stageRef.current) : await toSvg(stageRef.current);
      const link = document.createElement('a');
      link.download = `knowlify-canvas.${format}`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Export is a nice-to-have; a failure (e.g. cross-origin canvas taint)
      // shouldn't break the teaching session.
    }
  };

  return (
    <div className={`ai-canvas-shell ${presenting ? 'presenting' : ''}`}>
      <CanvasToolbar
        title={scene?.title || 'AI Canvas'}
        presenting={presenting}
        onTogglePresent={() => setPresenting((v) => !v)}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(1.6, z + 0.1))}
        onZoomOut={() => setZoom((z) => Math.max(0.6, z - 0.1))}
        onResetZoom={() => setZoom(1)}
        onExport={handleExport}
        onNewSession={resetSession}
        onFinishSession={() => setShowSummary(true)}
        hasHistory={history.length > 0}
      />

      <div className="ai-canvas-body" ref={stageRef} style={{ transform: `scale(${zoom})` }}>
        <CanvasStage />
      </div>

      {!presenting && (
        <>
          {!scene && !loading && (
            <div className="ai-canvas-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => requestScene(s)}>{s}</button>
              ))}
            </div>
          )}
          <form className="ai-canvas-composer" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your mentor to teach something on the canvas…"
              aria-label="Ask the AI Canvas"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Teach this">
              <Send size={16} />
            </button>
          </form>
        </>
      )}

      <AnimatePresence>
        {showSummary && <CanvasSummaryCard onClose={() => setShowSummary(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default AICanvasPage;
