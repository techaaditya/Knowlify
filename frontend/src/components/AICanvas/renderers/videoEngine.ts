/**
 * Video engine — pure animation maths + 2D-canvas drawing for the AI Canvas
 * video renderer. Given a scene payload and a time `t`, it interpolates each
 * element's keyframes and paints one frame. No React, no DOM state — so the
 * same code drives both live playback and the MediaRecorder export.
 */
import type { CanvasVideoElement, CanvasVideoKeyframe, CanvasVideoPayload } from '../canvasTypes';
import type { CompiledExpr } from './mathExpr';

export interface FrameAssets {
  latexImages: Map<string, HTMLImageElement>;
  plotFns: Map<string, CompiledExpr>;
}

export interface Transform {
  x: number; // 0–100
  y: number; // 0–100
  scale: number;
  opacity: number;
  rotate: number; // degrees
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolate an element's transform at time `t` (seconds). */
export function interpolate(keyframes: CanvasVideoKeyframe[], t: number): Transform {
  const def: Transform = { x: 50, y: 50, scale: 1, opacity: 1, rotate: 0 };
  if (!keyframes || keyframes.length === 0) return def;
  const kfs = [...keyframes].sort((a, b) => a.at - b.at);
  const norm = (k: CanvasVideoKeyframe): Transform => ({
    x: k.x ?? 50,
    y: k.y ?? 50,
    scale: k.scale ?? 1,
    opacity: k.opacity ?? 1,
    rotate: k.rotate ?? 0,
  });
  if (t <= kfs[0].at) return norm(kfs[0]);
  if (t >= kfs[kfs.length - 1].at) return norm(kfs[kfs.length - 1]);
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.at && t <= b.at) {
      const span = b.at - a.at || 1;
      const raw = (t - a.at) / span;
      // Ease-in-out for a smoother, less mechanical motion.
      const e = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      const ta = norm(a);
      const tb = norm(b);
      return {
        x: lerp(ta.x, tb.x, e),
        y: lerp(ta.y, tb.y, e),
        scale: lerp(ta.scale, tb.scale, e),
        opacity: lerp(ta.opacity, tb.opacity, e),
        rotate: lerp(ta.rotate, tb.rotate, e),
      };
    }
  }
  return norm(kfs[kfs.length - 1]);
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 10;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawPlot(
  ctx: CanvasRenderingContext2D,
  fn: CompiledExpr,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  color: string,
) {
  const xMin = -6;
  const xMax = 6;
  const samples = 120;
  const pts: Array<{ x: number; y: number }> = [];
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    let y: number;
    try {
      y = fn(x);
    } catch {
      y = NaN;
    }
    if (Number.isFinite(y) && Math.abs(y) < 1e4) {
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    pts.push({ x, y });
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = -5;
    yMax = 5;
  }
  if (yMax - yMin < 1e-6) {
    yMin -= 1;
    yMax += 1;
  }
  const left = cx - boxW / 2;
  const top = cy - boxH / 2;
  const sx = (x: number) => left + ((x - xMin) / (xMax - xMin)) * boxW;
  const sy = (y: number) => top + ((yMax - y) / (yMax - yMin)) * boxH;

  // Axes box.
  ctx.strokeStyle = 'rgba(90,85,76,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, boxW, boxH);
  if (yMin <= 0 && yMax >= 0) {
    ctx.beginPath();
    ctx.moveTo(left, sy(0));
    ctx.lineTo(left + boxW, sy(0));
    ctx.stroke();
  }
  // Curve.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  let pen = false;
  for (const p of pts) {
    const off = !Number.isFinite(p.y) || p.y > yMax + (yMax - yMin) * 3 || p.y < yMin - (yMax - yMin) * 3;
    if (off) {
      pen = false;
      continue;
    }
    const X = sx(p.x);
    const Y = sy(p.y);
    if (pen) ctx.lineTo(X, Y);
    else ctx.moveTo(X, Y);
    pen = true;
  }
  ctx.stroke();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: CanvasVideoElement,
  tr: Transform,
  w: number,
  h: number,
  assets: FrameAssets,
) {
  const px = (tr.x / 100) * w;
  const py = (tr.y / 100) * h;
  const color = el.props.color || '#3B3833';

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, tr.opacity));
  ctx.translate(px, py);
  if (tr.rotate) ctx.rotate((tr.rotate * Math.PI) / 180);
  ctx.scale(tr.scale, tr.scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (el.kind) {
    case 'text': {
      const size = el.props.fontSize || 24;
      ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = String(el.props.text || '').split('\n');
      lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * size * 1.2));
      break;
    }
    case 'latex': {
      const img = assets.latexImages.get(el.id);
      if (img && img.complete && img.naturalWidth > 0) {
        // Images are rasterised at pixelRatio 2 over a 22px KaTeX base, so
        // divide by 44 to map back to the requested font size in canvas px.
        const scaleFactor = ((el.props.fontSize || 28) / 44);
        const iw = img.naturalWidth * scaleFactor;
        const ih = img.naturalHeight * scaleFactor;
        ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      }
      break;
    }
    case 'rect': {
      const rw = ((el.props.width || 20) / 100) * w;
      const rh = ((el.props.height || 12) / 100) * h;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
      break;
    }
    case 'circle': {
      const r = ((el.props.radius || 10) / 100) * Math.min(w, h);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow': {
      // Endpoint is absolute (percent of canvas); undo the translate for it.
      const ex = ((el.props.x2 ?? tr.x) / 100) * w - px;
      const ey = ((el.props.y2 ?? tr.y) / 100) * h - py;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (el.kind === 'arrow') drawArrowHead(ctx, 0, 0, ex, ey);
      break;
    }
    case 'plot': {
      const fn = assets.plotFns.get(el.id);
      if (fn) drawPlot(ctx, fn, 0, 0, w * 0.32, h * 0.26, color);
      break;
    }
  }
  ctx.restore();
}

/** Paint one full frame of the video at time `t` (seconds). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  payload: CanvasVideoPayload,
  t: number,
  w: number,
  h: number,
  assets: FrameAssets,
) {
  ctx.fillStyle = payload.background || '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  for (const el of payload.elements || []) {
    const tr = interpolate(el.keyframes || [], t);
    if (tr.opacity <= 0.01) continue;
    drawElement(ctx, el, tr, w, h, assets);
  }

  // Burned-in caption at the bottom.
  const caption = (payload.captions || []).find((c) => t >= c.at && t <= c.end);
  if (caption && caption.text) {
    ctx.save();
    const barH = 54;
    ctx.fillStyle = 'rgba(30,28,25,0.82)';
    ctx.fillRect(0, h - barH, w, barH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '500 18px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Simple word-wrap to canvas width.
    const words = caption.text.split(/\s+/);
    const maxW = w - 60;
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const shown = lines.slice(-2);
    shown.forEach((l, i) => ctx.fillText(l, w / 2, h - barH / 2 + (i - (shown.length - 1) / 2) * 22));
    ctx.restore();
  }
}

export const clampDuration = (d: number): number => Math.max(3, Math.min(45, d || 15));
