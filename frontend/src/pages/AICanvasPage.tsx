import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { CanvasStage } from '../components/AICanvas/CanvasStage';
import { CanvasToolbar } from '../components/AICanvas/CanvasToolbar';
import { CanvasSummaryCard } from '../components/AICanvas/CanvasSummaryCard';
import { CanvasTypePalette, type PaletteChoice } from '../components/AICanvas/CanvasTypePalette';
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

const TYPE_HINT: Record<Exclude<PaletteChoice, 'auto'>, string> = {
  graph: ' (Use a graph/flowchart visualization.)',
  tree: ' (Use a tree-layout graph visualization.)',
  equation: ' (Use an equation visualization.)',
  plot: ' (Plot this as a function on a Cartesian grid.)',
  chart: ' (Use a bar/line chart visualization.)',
  comparison: ' (Use a comparison table visualization.)',
  timeline: ' (Use a timeline visualization.)',
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [paletteChoice, setPaletteChoice] = useState<PaletteChoice>('auto');
  const [showSummary, setShowSummary] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const lastHandledToken = useRef(0);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

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

  const withTypeHint = (text: string) =>
    paletteChoice === 'auto' ? text : `${text}${TYPE_HINT[paletteChoice]}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    requestScene(withTypeHint(text), { conceptId: launchConceptId });
  };

  const continueExplaining = () => {
    if (loading) return;
    requestScene('Explain this again, building on what you already showed me — continue, don\'t restart.', {
      conceptId: launchConceptId,
    });
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

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ── Infinite canvas: drag-to-pan on the background, wheel to pan/zoom ────
  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.target !== backgroundRef.current) return; // only the empty canvas, not the card/controls
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Pinch-zoom (trackpads dispatch wheel+ctrlKey) or ctrl+scroll.
      e.preventDefault();
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.01)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  return (
    <div className={`ai-canvas-shell ${presenting ? 'presenting' : ''}`}>
      <CanvasToolbar
        title={scene?.title || 'AI Canvas'}
        presenting={presenting}
        onTogglePresent={() => setPresenting((v) => !v)}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.15))}
        onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.15))}
        onResetZoom={resetView}
        onExport={handleExport}
        onNewSession={resetSession}
        onFinishSession={() => setShowSummary(true)}
        hasHistory={history.length > 0}
      />

      <div
        className="ai-canvas-infinite"
        ref={backgroundRef}
        onMouseDown={onBackgroundMouseDown}
        onWheel={onWheel}
      >
        <div className="ai-canvas-grid-bg" aria-hidden />
        <div
          className="ai-canvas-card"
          ref={stageRef}
          style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}
        >
          <CanvasStage />
        </div>
      </div>

      {!presenting && (
        <>
          <CanvasTypePalette value={paletteChoice} onChange={setPaletteChoice} />

          <div className="ai-canvas-floating-chat">
            {!scene && !loading && (
              <div className="ai-canvas-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => requestScene(withTypeHint(s))}>{s}</button>
                ))}
              </div>
            )}
            {scene && !loading && (
              <div className="ai-canvas-suggestions">
                <button type="button" onClick={continueExplaining}>Explain this again</button>
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
          </div>
        </>
      )}

      <AnimatePresence>
        {showSummary && <CanvasSummaryCard onClose={() => setShowSummary(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default AICanvasPage;
