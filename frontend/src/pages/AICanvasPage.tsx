import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { CanvasStage } from '../components/AICanvas/CanvasStage';
import { CanvasToolbar } from '../components/AICanvas/CanvasToolbar';
import { CanvasSummaryCard } from '../components/AICanvas/CanvasSummaryCard';
import { CanvasInspector } from '../components/AICanvas/CanvasInspector';
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
  plot: ' (Use a diagram, chart, or function-plot visualization — whichever fits best.)',
  mindmap: ' (Create a mind map with a central idea and branches.)',
  infographic: ' (Design a study infographic poster.)',
  video: ' (Create a short animated video lesson.)',
};

// Palette choices that map to a focused backend `canvas_type` (single-schema prompt).
const CANVAS_TYPE_FOR: Partial<Record<PaletteChoice, string>> = {
  mindmap: 'mindmap',
  infographic: 'infographic',
  video: 'video',
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export const AICanvasPage: React.FC = () => {
  const scene = useCanvasSessionStore((s) => s.scene);
  const loading = useCanvasSessionStore((s) => s.loading);
  const history = useCanvasSessionStore((s) => s.history);
  const requestScene = useCanvasSessionStore((s) => s.requestScene);
  const resetSession = useCanvasSessionStore((s) => s.resetSession);
  const undo = useCanvasSessionStore((s) => s.undo);
  const redo = useCanvasSessionStore((s) => s.redo);
  const past = useCanvasSessionStore((s) => s.past);
  const future = useCanvasSessionStore((s) => s.future);
  const nextStep = useCanvasSessionStore((s) => s.nextStep);
  const prevStep = useCanvasSessionStore((s) => s.prevStep);
  const togglePlay = useCanvasSessionStore((s) => s.togglePlay);

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
  const [toast, setToast] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const lastHandledToken = useRef(0);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // Mirror view state in refs so the wheel handler reads fresh values without
  // nesting one state setter inside another.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

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

  const send = (text: string) =>
    requestScene(withTypeHint(text), {
      conceptId: launchConceptId,
      canvasType: CANVAS_TYPE_FOR[paletteChoice],
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    send(text);
  };

  const continueExplaining = () => {
    if (loading) return;
    requestScene('Explain this again, building on what you already showed me — continue, don\'t restart.', {
      conceptId: launchConceptId,
      canvasType: CANVAS_TYPE_FOR[paletteChoice],
    });
  };

  const handleExport = async (format: 'png' | 'svg') => {
    if (!stageRef.current) return;
    try {
      const opts = { pixelRatio: 2, cacheBust: true };
      const dataUrl = format === 'png' ? await toPng(stageRef.current, opts) : await toSvg(stageRef.current);
      const link = document.createElement('a');
      link.download = `knowlify-canvas.${format}`;
      link.href = dataUrl;
      link.click();
    } catch {
      flashToast('Export failed — try again, or switch off presentation mode.');
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomToFit = () => {
    const el = backgroundRef.current;
    setPan({ x: 0, y: 0 });
    if (!el) {
      setZoom(1);
      return;
    }
    const cardH = 560;
    setZoom(clampZoom(Math.min(1, (el.clientHeight - 48) / cardH)));
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
      // Cursor-anchored pinch/ctrl zoom: keep the point under the cursor fixed.
      e.preventDefault();
      const el = backgroundRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left - rect.width / 2;
      const sy = e.clientY - rect.top - rect.height / 2;
      const z = zoomRef.current;
      const p = panRef.current;
      const nz = clampZoom(z - e.deltaY * 0.01);
      if (nz === z) return;
      setZoom(nz);
      setPan({ x: sx - (nz / z) * (sx - p.x), y: sy - (nz / z) * (sy - p.y) });
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  // ── Keyboard shortcuts (ignored while typing in a field) ────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (!scene) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, undo, redo, nextStep, prevStep, togglePlay]);

  return (
    <div className={`ai-canvas-shell ${presenting ? 'presenting' : ''}`}>
      <CanvasToolbar
        title={scene?.title || 'AI Canvas'}
        presenting={presenting}
        onTogglePresent={() => setPresenting((v) => !v)}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => clampZoom(z + 0.15))}
        onZoomOut={() => setZoom((z) => clampZoom(z - 0.15))}
        onResetZoom={resetView}
        onZoomFit={zoomToFit}
        onExport={handleExport}
        onNewSession={resetSession}
        onFinishSession={() => setShowSummary(true)}
        hasHistory={history.length > 0 || !!scene}
        onUndo={undo}
        onRedo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
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

          <AnimatePresence>
            <CanvasInspector />
          </AnimatePresence>

          <div className="ai-canvas-floating-chat">
            {!scene && !loading && (
              <div className="ai-canvas-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}>{s}</button>
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

      {toast && <div className="ai-canvas-toast">{toast}</div>}

      <AnimatePresence>
        {showSummary && <CanvasSummaryCard onClose={() => setShowSummary(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default AICanvasPage;
