import React from 'react';
import { motion } from 'framer-motion';
import type { CanvasComparisonPayload } from '../canvasTypes';

interface Props {
  payload: CanvasComparisonPayload;
}

export const ComparisonRenderer: React.FC<Props> = ({ payload }) => (
  <div className="ai-canvas-comparison">
    <table>
      <thead>
        <tr>
          {payload.columns.map((col, i) => (
            <th key={i}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {payload.rows.map((row, ri) => (
          <motion.tr
            key={ri}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ri * 0.08, duration: 0.3 }}
          >
            <td className="ai-canvas-comparison-label">{row.label}</td>
            {row.values.map((v, vi) => (
              <td key={vi}>{v}</td>
            ))}
          </motion.tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ComparisonRenderer;
