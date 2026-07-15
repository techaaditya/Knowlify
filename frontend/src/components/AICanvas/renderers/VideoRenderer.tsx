import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { toPng } from 'html-to-image';
import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import type { CanvasVideoPayload } from '../canvasTypes';
import { compileExpr, type CompiledExpr } from './mathExpr';
import { clampDuration, drawFrame, type FrameAssets } from './videoEngine';

interface Props {
  payload: CanvasVideoPayload;
}

const CANVAS_W = 640;
const CANVAS_H = 400;

async function rasterizeLatex(latex: string): Promise<HTMLImageElement | null> {
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-99999px';
  holder.style.top = '0';
  holder.style.padding = '2px 6px';
  holder.style.fontSize = '22px';
  holder.style.color = '#3B3833';
  holder.style.background = 'transparent';
  try {
    katex.render(latex, holder, { throwOnError: false, displayMode: true });
  } catch {
    return null;
  }
  document.body.appendChild(holder);
  try {
    const dataUrl = await toPng(holder, { pixelRatio: 2, cacheBust: true });
    const img = new Image();
    img.src = dataUrl;
    try {
      await img.decode();
    } catch {
      /* decode() can reject on some browsers; the draw path guards on complete */
    }
    return img;
  } catch {
    return null;
  } finally {
    document.body.removeChild(holder);
  }
}

/**
 * Plays an LLM-authored animated lesson on a real <canvas> (via requestAnimation-
 * Frame), narrates the captions with the browser's speech synthesis, and can
 * export the animation to a .webm file using canvas.captureStream + MediaRecorder.
 * The exported file is silent — TTS audio can't be captured into the stream —
 * but captions are burned in.
 */
export const VideoRenderer: React.FC<Props> = ({ payload }) => {
  const duration = clampDuration(payload.duration);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<FrameAssets>({ latexImages: new Map(), plotFns: new Map() });
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const baseRef = useRef<number>(0); // playback time when the current run started
  const spokenRef = useRef<Set<number>>(new Set());

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [recording, setRecording] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);

  // Compile plot expressions + rasterize LaTeX whenever the scene changes.
  useEffect(() => {
    let cancelled = false;
    const plotFns = new Map<string, CompiledExpr>();
    for (const el of payload.elements || []) {
      if (el.kind === 'plot' && el.props.expr) {
        try {
          plotFns.set(el.id, compileExpr(el.props.expr));
        } catch {
          /* skip unparseable */
        }
      }
    }
    const latexImages = new Map<string, HTMLImageElement>();
    assetsRef.current = { latexImages, plotFns };
    setAssetsReady(false);

    const latexEls = (payload.elements || []).filter((e) => e.kind === 'latex' && e.props.latex);
    Promise.all(
      latexEls.map(async (el) => {
        const img = await rasterizeLatex(el.props.latex as string);
        if (img && !cancelled) latexImages.set(el.id, img);
      }),
    ).finally(() => {
      if (!cancelled) setAssetsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [payload]);

  const paint = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawFrame(ctx, payload, t, CANVAS_W, CANVAS_H, assetsRef.current);
    },
    [payload],
  );

  // Repaint a static frame whenever we're not playing (scrub, load, step change).
  useEffect(() => {
    if (!playing) paint(time);
  }, [paint, playing, time, assetsReady]);

  const speakDue = useCallback(
    (t: number) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      (payload.captions || []).forEach((c, i) => {
        if (!spokenRef.current.has(i) && t >= c.at && t < c.end) {
          spokenRef.current.add(i);
          try {
            const u = new SpeechSynthesisUtterance(c.text);
            u.rate = 1;
            u.pitch = 1;
            window.speechSynthesis.speak(u);
          } catch {
            /* speech is best-effort */
          }
        }
      });
    },
    [payload],
  );

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const runLoop = useCallback(
    (withSpeech: boolean, onDone?: () => void) => {
      startRef.current = performance.now();
      const loop = () => {
        const elapsed = (performance.now() - startRef.current) / 1000;
        const t = baseRef.current + elapsed;
        if (t >= duration) {
          paint(duration);
          setTime(duration);
          setPlaying(false);
          stopLoop();
          onDone?.();
          return;
        }
        paint(t);
        setTime(t);
        if (withSpeech) speakDue(t);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [duration, paint, speakDue, stopLoop],
  );

  const play = useCallback(() => {
    if (playing) return;
    if (time >= duration) {
      baseRef.current = 0;
      setTime(0);
      spokenRef.current = new Set();
    } else {
      baseRef.current = time;
    }
    setPlaying(true);
    runLoop(true);
  }, [playing, time, duration, runLoop]);

  const pause = useCallback(() => {
    setPlaying(false);
    stopLoop();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [stopLoop]);

  const restart = useCallback(() => {
    pause();
    baseRef.current = 0;
    spokenRef.current = new Set();
    setTime(0);
    paint(0);
  }, [pause, paint]);

  const onSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pause();
      const t = Number(e.target.value);
      baseRef.current = t;
      spokenRef.current = new Set();
      setTime(t);
      paint(t);
    },
    [pause, paint],
  );

  const supportsRecording = typeof window !== 'undefined' && 'MediaRecorder' in window;

  const exportVideo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || recording || !supportsRecording) return;
    pause();
    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      return;
    }
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowlify-lesson.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRecording(false);
    };

    setRecording(true);
    baseRef.current = 0;
    setTime(0);
    spokenRef.current = new Set();
    recorder.start();
    // Drive the animation for the export (no speech — it can't be captured).
    runLoop(false, () => {
      // Give the recorder a beat to flush the final frame.
      setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 120);
    });
  }, [recording, supportsRecording, pause, runLoop]);

  useEffect(() => () => {
    stopLoop();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [stopLoop]);

  const pct = useMemo(() => (duration > 0 ? (time / duration) * 100 : 0), [time, duration]);

  return (
    <div className="ai-canvas-video">
      <div className="ai-canvas-video-frame">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
        {!assetsReady && <div className="ai-canvas-video-loading">Preparing animation…</div>}
      </div>

      <div className="ai-canvas-video-controls">
        <button type="button" className="ai-canvas-step-btn primary" onClick={playing ? pause : play} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button type="button" className="ai-canvas-step-btn" onClick={restart} aria-label="Restart">
          <RotateCcw size={14} />
        </button>
        <input
          type="range"
          className="ai-canvas-video-seek"
          min={0}
          max={duration}
          step={0.05}
          value={time}
          onChange={onSeek}
          style={{ ['--seek-pct' as string]: `${pct}%` }}
          aria-label="Seek video"
        />
        <span className="ai-canvas-video-time">
          {time.toFixed(1)} / {duration.toFixed(0)}s
        </span>
        {supportsRecording && (
          <button
            type="button"
            className="ai-canvas-toolbar-btn"
            onClick={exportVideo}
            disabled={recording}
            title="Export as .webm video (silent, captions burned in)"
          >
            <Download size={14} /> {recording ? 'Recording…' : 'Export'}
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoRenderer;
