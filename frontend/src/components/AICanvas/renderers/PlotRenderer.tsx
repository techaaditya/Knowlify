import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CanvasPlotPayload } from '../canvasTypes';
import { compileExpr } from './mathExpr';

interface Props {
  payload: CanvasPlotPayload;
}

const WIDTH = 640;
const HEIGHT = 440;
const PAD_L = 46;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 30;

const PLOT_W = WIDTH - PAD_L - PAD_R;
const PLOT_H = HEIGHT - PAD_T - PAD_B;

const CURVE_COLORS = ['#B08968', '#5E8B7E', '#8A6FB0', '#C08552'];
const SAMPLES = 260;

/** A "nice" gridline step (1, 2, 5 × 10ⁿ) for a rough target interval. */
function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * pow;
}

function ticks(min: number, max: number, target: number): number[] {
  const step = niceStep((max - min) / target);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toFixed(6)));
  }
  return out;
}

/**
 * A Desmos-style function grapher. Evaluates each function expression over the
 * visible x-domain and draws the curve on a true Cartesian grid (labelled axes,
 * gridlines, origin) — the correct way to "graph y = f(x)", unlike the
 * categorical chart renderer.
 */
export const PlotRenderer: React.FC<Props> = ({ payload }) => {
  const model = useMemo(() => {
    const [xMin, xMax] = payload.xRange && payload.xRange[0] < payload.xRange[1] ? payload.xRange : [-10, 10];

    // Compile each function once; skip any that don't parse.
    const compiled = (payload.functions || [])
      .map((f, i) => {
        try {
          return { fn: compileExpr(f.expr), label: f.label || f.expr, highlight: f.highlight, color: CURVE_COLORS[i % CURVE_COLORS.length] };
        } catch {
          return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Sample every curve, collecting finite y's to auto-fit the y-range.
    const series = compiled.map((c) => {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const x = xMin + ((xMax - xMin) * i) / SAMPLES;
        let y: number;
        try {
          y = c.fn(x);
        } catch {
          y = NaN;
        }
        pts.push({ x, y });
      }
      return { ...c, pts };
    });

    let yMin: number;
    let yMax: number;
    if (payload.yRange && payload.yRange[0] < payload.yRange[1]) {
      [yMin, yMax] = payload.yRange;
    } else {
      const finite = series
        .flatMap((s) => s.pts.map((p) => p.y))
        .concat((payload.points || []).map((p) => p.y))
        .filter((y) => Number.isFinite(y) && Math.abs(y) < 1e5);
      if (finite.length) {
        yMin = Math.min(...finite);
        yMax = Math.max(...finite);
      } else {
        yMin = -10;
        yMax = 10;
      }
      // Pad, and make sure the plot has vertical height even for a flat line.
      const span = yMax - yMin || Math.max(1, Math.abs(yMax) || 1);
      yMin -= span * 0.12;
      yMax += span * 0.12;
    }

    const sx = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin)) * PLOT_W;
    const sy = (y: number) => PAD_T + ((yMax - y) / (yMax - yMin)) * PLOT_H;

    // Build an SVG path per curve, breaking at discontinuities / asymptotes.
    const ySpan = yMax - yMin;
    const paths = series.map((s) => {
      let d = '';
      let penDown = false;
      for (const p of s.pts) {
        const off = !Number.isFinite(p.y) || p.y > yMax + ySpan * 4 || p.y < yMin - ySpan * 4;
        if (off) {
          penDown = false;
          continue;
        }
        d += `${penDown ? 'L' : 'M'} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)} `;
        penDown = true;
      }
      return { d, color: s.color, label: s.label, highlight: s.highlight };
    });

    return {
      xMin,
      xMax,
      yMin,
      yMax,
      sx,
      sy,
      paths,
      xTicks: ticks(xMin, xMax, 10),
      yTicks: ticks(yMin, yMax, 8),
      markedPoints: (payload.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      hasCurves: paths.some((p) => p.d.length > 0),
    };
  }, [payload]);

  const { xMin, xMax, yMin, yMax, sx, sy, paths, xTicks, yTicks, markedPoints } = model;

  const yAxisX = xMin <= 0 && xMax >= 0 ? sx(0) : null; // vertical axis (x=0)
  const xAxisY = yMin <= 0 && yMax >= 0 ? sy(0) : null; // horizontal axis (y=0)

  if (!model.hasCurves && markedPoints.length === 0) {
    return (
      <div className="ai-canvas-plot">
        <p className="ai-canvas-plot-error">Couldn't read that function. Try something like “y = 2x + 1” or “y = x^2”.</p>
      </div>
    );
  }

  return (
    <div className="ai-canvas-plot">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="auto" role="img" aria-label="Function graph">
        {/* Vertical gridlines + x tick labels */}
        {xTicks.map((tx) => {
          const X = sx(tx);
          return (
            <g key={`gx${tx}`}>
              <line x1={X} x2={X} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="#EDE8DF" strokeWidth={1} />
              <text x={X} y={PAD_T + PLOT_H + 16} textAnchor="middle" fontSize="10" fill="#A79F92">
                {tx}
              </text>
            </g>
          );
        })}
        {/* Horizontal gridlines + y tick labels */}
        {yTicks.map((ty) => {
          const Y = sy(ty);
          return (
            <g key={`gy${ty}`}>
              <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={Y} y2={Y} stroke="#EDE8DF" strokeWidth={1} />
              {ty !== 0 && (
                <text x={PAD_L - 6} y={Y + 3} textAnchor="end" fontSize="10" fill="#A79F92">
                  {ty}
                </text>
              )}
            </g>
          );
        })}

        {/* Bold axes through the origin (when visible) */}
        {xAxisY !== null && (
          <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={xAxisY} y2={xAxisY} stroke="#8A8073" strokeWidth={1.5} />
        )}
        {yAxisX !== null && (
          <line x1={yAxisX} y1={PAD_T} x2={yAxisX} y2={PAD_T + PLOT_H} stroke="#8A8073" strokeWidth={1.5} />
        )}

        {/* Curves */}
        {paths.map((p, i) =>
          p.d ? (
            <motion.path
              key={i}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={p.highlight ? 3 : 2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.15 }}
            />
          ) : null,
        )}

        {/* Marked points */}
        {markedPoints.map((pt, i) => {
          if (pt.x < xMin || pt.x > xMax || pt.y < yMin || pt.y > yMax) return null;
          return (
            <g key={`pt${i}`}>
              <circle cx={sx(pt.x)} cy={sy(pt.y)} r={4.5} fill="#FFFFFF" stroke="#B08968" strokeWidth={2} />
              <text x={sx(pt.x) + 7} y={sy(pt.y) - 7} fontSize="11" fontWeight={700} fill="#3B3833">
                {pt.label || `(${pt.x}, ${pt.y})`}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="ai-canvas-plot-legend">
        {paths.map((p, i) => (
          <span key={i} className="ai-canvas-plot-legend-item">
            <span className="ai-canvas-plot-swatch" style={{ background: p.color }} aria-hidden />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default PlotRenderer;
