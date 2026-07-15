import React from 'react';
import { motion } from 'framer-motion';
import type { CanvasTimelinePayload } from '../canvasTypes';

interface Props {
  payload: CanvasTimelinePayload;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

export const TimelineRenderer: React.FC<Props> = ({ payload, selectedIndex, onSelect }) => (
  <div className="ai-canvas-timeline">
    {payload.events.map((ev, i) => (
      <motion.div
        key={i}
        className={`ai-canvas-timeline-item ${ev.active ? 'active' : ''} ${selectedIndex === i ? 'selected' : ''}`}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.1, duration: 0.3 }}
        onClick={onSelect ? () => onSelect(i) : undefined}
        style={onSelect ? { cursor: 'pointer' } : undefined}
      >
        <span className="ai-canvas-timeline-dot" />
        <div className="ai-canvas-timeline-body">
          <strong>{ev.label}</strong>
          {ev.detail && <p>{ev.detail}</p>}
        </div>
        {i < payload.events.length - 1 && <span className="ai-canvas-timeline-line" />}
      </motion.div>
    ))}
  </div>
);

export default TimelineRenderer;
