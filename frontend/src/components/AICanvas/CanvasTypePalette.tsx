import React from 'react';
import { Sparkles, Share2, GitBranch, Sigma, BarChart3, LineChart, Table2, ListOrdered, type LucideIcon } from 'lucide-react';

export type PaletteChoice = 'auto' | 'graph' | 'tree' | 'equation' | 'plot' | 'chart' | 'comparison' | 'timeline';

interface Props {
  value: PaletteChoice;
  onChange: (choice: PaletteChoice) => void;
}

const OPTIONS: Array<{ id: PaletteChoice; label: string; Icon: LucideIcon }> = [
  { id: 'auto', label: 'Auto', Icon: Sparkles },
  { id: 'graph', label: 'Graph', Icon: Share2 },
  { id: 'tree', label: 'Tree', Icon: GitBranch },
  { id: 'equation', label: 'Equation', Icon: Sigma },
  { id: 'plot', label: 'Plot', Icon: LineChart },
  { id: 'chart', label: 'Chart', Icon: BarChart3 },
  { id: 'comparison', label: 'Compare', Icon: Table2 },
  { id: 'timeline', label: 'Timeline', Icon: ListOrdered },
];

/**
 * Floating tool palette — the AI picks the visualization type by default
 * ("Auto"), but a student/teacher can force one when they know exactly what
 * shape they want (e.g. force "Tree" for a binary tree that the model
 * mis-classified as a general graph).
 */
export const CanvasTypePalette: React.FC<Props> = ({ value, onChange }) => (
  <div className="ai-canvas-type-palette" role="radiogroup" aria-label="Visualization type">
    {OPTIONS.map(({ id, label, Icon }) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={value === id}
        className={`ai-canvas-type-btn ${value === id ? 'active' : ''}`}
        onClick={() => onChange(id)}
        title={label}
      >
        <Icon size={14} />
      </button>
    ))}
  </div>
);

export default CanvasTypePalette;
