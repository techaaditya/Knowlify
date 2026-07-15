import React from 'react';
import { motion } from 'framer-motion';
import { X, MessageCircleQuestion } from 'lucide-react';
import { useCanvasSessionStore } from './canvasSessionStore';
import type { CanvasStep } from './canvasTypes';

/**
 * Floating inspector for the currently selected canvas element. Lets the user
 * edit labels/values inline (changes flow through the store's undo/redo) and
 * ask the tutor to expand on that specific element.
 */
export const CanvasInspector: React.FC = () => {
  const scene = useCanvasSessionStore((s) => s.scene);
  const stepIndex = useCanvasSessionStore((s) => s.stepIndex);
  const selection = useCanvasSessionStore((s) => s.selection);
  const select = useCanvasSessionStore((s) => s.select);
  const updateNode = useCanvasSessionStore((s) => s.updateNode);
  const updateChartPoint = useCanvasSessionStore((s) => s.updateChartPoint);
  const updateTimelineEvent = useCanvasSessionStore((s) => s.updateTimelineEvent);
  const updateComparisonRow = useCanvasSessionStore((s) => s.updateComparisonRow);
  const requestScene = useCanvasSessionStore((s) => s.requestScene);

  if (!scene || !selection) return null;
  const step = scene.steps[stepIndex] as CanvasStep | undefined;
  if (!step) return null;

  const explain = (label: string) =>
    requestScene(`Tell me more about "${label}" in the context of ${scene.title}. Keep it brief.`);

  let title = 'Element';
  let body: React.ReactNode = null;

  if (selection.type === 'node') {
    const payload = (step as any)[scene.visualization];
    const node = payload?.nodes?.find((n: { id: string }) => n.id === selection.id);
    if (!node) return null;
    title = 'Node';
    body = (
      <>
        <label>
          Label
          <input value={node.label || ''} onChange={(e) => updateNode(node.id, { label: e.target.value })} />
        </label>
        <label>
          Note
          <textarea
            rows={3}
            value={node.note || ''}
            placeholder="Add a short note…"
            onChange={(e) => updateNode(node.id, { note: e.target.value })}
          />
        </label>
        <button type="button" className="ai-canvas-inspector-explain" onClick={() => explain(node.label)}>
          <MessageCircleQuestion size={14} /> Explain this
        </button>
      </>
    );
  } else if (selection.type === 'chartPoint') {
    const pt = step.chart?.points?.[selection.index];
    if (!pt) return null;
    title = 'Data point';
    body = (
      <>
        <label>
          Label
          <input value={pt.label || ''} onChange={(e) => updateChartPoint(selection.index, { label: e.target.value })} />
        </label>
        <label>
          Value
          <input
            type="number"
            value={pt.value}
            onChange={(e) => updateChartPoint(selection.index, { value: Number(e.target.value) })}
          />
        </label>
        <button type="button" className="ai-canvas-inspector-explain" onClick={() => explain(pt.label)}>
          <MessageCircleQuestion size={14} /> Explain this
        </button>
      </>
    );
  } else if (selection.type === 'timelineEvent') {
    const ev = step.timeline?.events?.[selection.index];
    if (!ev) return null;
    title = 'Timeline event';
    body = (
      <>
        <label>
          Label
          <input value={ev.label || ''} onChange={(e) => updateTimelineEvent(selection.index, { label: e.target.value })} />
        </label>
        <label>
          Detail
          <textarea
            rows={3}
            value={ev.detail || ''}
            onChange={(e) => updateTimelineEvent(selection.index, { detail: e.target.value })}
          />
        </label>
        <button type="button" className="ai-canvas-inspector-explain" onClick={() => explain(ev.label)}>
          <MessageCircleQuestion size={14} /> Explain this
        </button>
      </>
    );
  } else if (selection.type === 'comparisonRow') {
    const row = step.comparison?.rows?.[selection.index];
    if (!row) return null;
    title = 'Comparison row';
    body = (
      <>
        <label>
          Label
          <input
            value={row.label || ''}
            onChange={(e) => updateComparisonRow(selection.index, { label: e.target.value })}
          />
        </label>
        {row.values.map((v, i) => (
          <label key={i}>
            {scene.steps[stepIndex].comparison?.columns[i + 1] || `Value ${i + 1}`}
            <input
              value={v}
              onChange={(e) => {
                const values = [...row.values];
                values[i] = e.target.value;
                updateComparisonRow(selection.index, { values });
              }}
            />
          </label>
        ))}
        <button type="button" className="ai-canvas-inspector-explain" onClick={() => explain(row.label)}>
          <MessageCircleQuestion size={14} /> Explain this
        </button>
      </>
    );
  }

  if (!body) return null;

  return (
    <motion.div
      className="ai-canvas-inspector"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
    >
      <header>
        <span>{title}</span>
        <button type="button" onClick={() => select(null)} aria-label="Close inspector">
          <X size={15} />
        </button>
      </header>
      <div className="ai-canvas-inspector-body">{body}</div>
    </motion.div>
  );
};

export default CanvasInspector;
