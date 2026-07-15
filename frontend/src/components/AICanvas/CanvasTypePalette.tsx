import React from 'react';
import {
  Sparkles,
  LineChart,
  Brain,
  LayoutTemplate,
  Clapperboard,
  type LucideIcon,
} from 'lucide-react';

export type PaletteChoice =
  | 'auto'
  | 'plot'
  | 'mindmap'
  | 'infographic'
  | 'video';

interface Props {
  value: PaletteChoice;
  onChange: (choice: PaletteChoice) => void;
}

const OPTIONS: Array<{ id: PaletteChoice; label: string; Icon: LucideIcon }> = [
  { id: 'auto', label: 'Auto — let the AI decide', Icon: Sparkles },
  { id: 'plot', label: 'Diagram / chart / plot', Icon: LineChart },
  { id: 'mindmap', label: 'Mind map', Icon: Brain },
  { id: 'infographic', label: 'Infographic', Icon: LayoutTemplate },
  { id: 'video', label: 'Video lesson', Icon: Clapperboard },
];

/**
 * Floating tool palette. "Auto" is the default — you just describe what you
 * want and the AI picks the best visualization. The other buttons force a
 * specific format: one combined diagram/chart/plot option, plus the three
 * richer formats (mind map, infographic, video) that benefit from a focused
 * prompt.
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
        aria-label={label}
      >
        <Icon size={15} />
      </button>
    ))}
  </div>
);

export default CanvasTypePalette;
