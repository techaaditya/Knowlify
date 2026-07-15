import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CanvasChartPayload } from '../canvasTypes';

interface Props {
  payload: CanvasChartPayload;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

const WIDTH = 560;
const HEIGHT = 320;
const PAD_L = 44;
const PAD_B = 36;
const PAD_T = 16;
const PAD_R = 16;

/**
 * Lightweight hand-rolled SVG bar/line chart — statistics and data-workflow
 * style visualizations don't need a full charting library; a plain SVG keeps
 * the bundle small and the styling consistent with the rest of the canvas.
 */
export const ChartRenderer: React.FC<Props> = ({ payload, selectedIndex, onSelect }) => {
  const { points, kind, unit } = payload;
  const clickProps = (i: number) =>
    onSelect ? { onClick: () => onSelect(i), style: { cursor: 'pointer' } } : {};

  const { plotW, plotH, xForIndex, yForValue } = useMemo(() => {
    const maxVal = Math.max(1, ...points.map((p) => p.value));
    const w = WIDTH - PAD_L - PAD_R;
    const h = HEIGHT - PAD_T - PAD_B;
    return {
      plotW: w,
      plotH: h,
      xForIndex: (i: number) => PAD_L + (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w),
      yForValue: (v: number) => PAD_T + h - (v / maxVal) * h,
    };
  }, [points]);

  const barSlot = plotW / points.length;
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(p.value)}`)
    .join(' ');

  return (
    <div className="ai-canvas-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="auto" role="img" aria-label={`${kind} chart`}>
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD_L}
            x2={WIDTH - PAD_R}
            y1={PAD_T + plotH * (1 - t)}
            y2={PAD_T + plotH * (1 - t)}
            stroke="var(--border-faint, #eee)"
            strokeWidth={1}
          />
        ))}

        {kind === 'bar' &&
          points.map((p, i) => {
            const barW = barSlot * 0.55;
            const x = xForIndex(i) - barW / 2;
            const y = yForValue(p.value);
            const selected = selectedIndex === i;
            return (
              <g key={i} {...clickProps(i)}>
                <motion.rect
                  x={x}
                  width={barW}
                  y={PAD_T + plotH}
                  height={0}
                  rx={6}
                  fill={p.highlight ? '#BCA88A' : 'rgba(188,168,138,0.45)'}
                  stroke={selected ? '#8A6D3B' : 'none'}
                  strokeWidth={selected ? 2.5 : 0}
                  animate={{ y, height: PAD_T + plotH - y }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
                />
                <text x={xForIndex(i)} y={y - 8} textAnchor="middle" fontSize="12" fontWeight={700} fill="#3B3833">
                  {p.value}
                  {unit || ''}
                </text>
                <text x={xForIndex(i)} y={HEIGHT - PAD_B + 18} textAnchor="middle" fontSize="11" fill="#9E978C">
                  {p.label}
                </text>
              </g>
            );
          })}

        {kind === 'line' && (
          <>
            <motion.path
              d={linePath}
              fill="none"
              stroke="#BCA88A"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            {points.map((p, i) => (
              <g key={i} {...clickProps(i)}>
                <circle
                  cx={xForIndex(i)}
                  cy={yForValue(p.value)}
                  r={selectedIndex === i ? 7 : p.highlight ? 6 : 4}
                  fill={p.highlight ? '#BCA88A' : '#FFFFFF'}
                  stroke={selectedIndex === i ? '#8A6D3B' : '#BCA88A'}
                  strokeWidth={selectedIndex === i ? 3 : 2}
                />
                <text x={xForIndex(i)} y={yForValue(p.value) - 12} textAnchor="middle" fontSize="12" fontWeight={700} fill="#3B3833">
                  {p.value}
                  {unit || ''}
                </text>
                <text x={xForIndex(i)} y={HEIGHT - PAD_B + 18} textAnchor="middle" fontSize="11" fill="#9E978C">
                  {p.label}
                </text>
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
};

export default ChartRenderer;
