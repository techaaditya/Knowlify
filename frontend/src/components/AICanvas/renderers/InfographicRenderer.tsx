import React from 'react';
import { motion } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  ArrowRight,
  Check,
  X,
  Star,
  Lightbulb,
  Target,
  Zap,
  TrendingUp,
  Info,
  BookOpen,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import type { CanvasInfographicBlock, CanvasInfographicPayload } from '../canvasTypes';

interface Props {
  payload: CanvasInfographicPayload;
}

const ICONS: Record<string, LucideIcon> = {
  check: Check,
  x: X,
  star: Star,
  lightbulb: Lightbulb,
  idea: Lightbulb,
  target: Target,
  zap: Zap,
  bolt: Zap,
  trend: TrendingUp,
  'trending-up': TrendingUp,
  info: Info,
  book: BookOpen,
  quote: Quote,
};

const THEMES = {
  warm: { accent: '#B08968', soft: 'rgba(176,137,104,0.12)', ring: 'rgba(176,137,104,0.28)' },
  cool: { accent: '#5E8B7E', soft: 'rgba(94,139,126,0.12)', ring: 'rgba(94,139,126,0.28)' },
  mono: { accent: '#5A554C', soft: 'rgba(90,85,76,0.10)', ring: 'rgba(90,85,76,0.24)' },
};

const iconFor = (name?: string): LucideIcon => (name && ICONS[name.toLowerCase()]) || Check;

/** How wide a block should be on the 2-column poster grid. */
const isWide = (b: CanvasInfographicBlock): boolean =>
  b.kind === 'compare' || b.kind === 'quote' || b.kind === 'process';

function Block({ block, accent }: { block: CanvasInfographicBlock; accent: string }) {
  switch (block.kind) {
    case 'stat': {
      const Icon = iconFor(block.icon);
      return (
        <div className="ai-info-stat">
          <Icon size={20} style={{ color: accent }} />
          <div className="ai-info-stat-value" style={{ color: accent }}>{block.value}</div>
          <div className="ai-info-stat-label">{block.label}</div>
          {block.trend && <div className="ai-info-stat-trend">{block.trend}</div>}
        </div>
      );
    }
    case 'facts':
      return (
        <div className="ai-info-facts">
          {block.heading && <h4>{block.heading}</h4>}
          <ul>
            {block.items.map((it, i) => {
              const Icon = iconFor(it.icon);
              return (
                <li key={i}>
                  <Icon size={15} style={{ color: accent }} /> <span>{it.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    case 'process':
      return (
        <div className="ai-info-process">
          {block.heading && <h4>{block.heading}</h4>}
          <div className="ai-info-process-row">
            {block.steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className="ai-info-process-step" style={{ borderColor: accent }}>
                  <span className="ai-info-process-num" style={{ background: accent }}>{i + 1}</span>
                  <span>{s}</span>
                </div>
                {i < block.steps.length - 1 && <ArrowRight size={16} className="ai-info-process-arrow" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    case 'compare':
      return (
        <div className="ai-info-compare">
          {block.heading && <h4>{block.heading}</h4>}
          <div className="ai-info-compare-cols">
            {[block.left, block.right].map((col, ci) => (
              <div key={ci} className="ai-info-compare-col">
                <div className="ai-info-compare-title" style={{ color: accent }}>{col.title}</div>
                <ul>
                  {col.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    case 'quote':
      return (
        <div className="ai-info-quote" style={{ borderColor: accent }}>
          <Quote size={18} style={{ color: accent }} />
          <p>{block.text}</p>
          {block.source && <cite>— {block.source}</cite>}
        </div>
      );
    case 'formula': {
      let html = '';
      try {
        html = katex.renderToString(block.latex, { throwOnError: false, displayMode: true });
      } catch {
        html = '';
      }
      return (
        <div className="ai-info-formula">
          {html ? (
            // eslint-disable-next-line react/no-danger
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <code>{block.latex}</code>
          )}
          {block.caption && <span className="ai-info-formula-caption">{block.caption}</span>}
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Renders a study infographic — a single polished poster of stat cards, fact
 * lists, process flows, comparisons, quotes and formulas laid out on a themed
 * 2-column grid. Exportable to PNG via the toolbar (targets .ai-info-poster).
 */
export const InfographicRenderer: React.FC<Props> = ({ payload }) => {
  const theme = THEMES[payload.theme || 'warm'] || THEMES.warm;
  const blocks = payload.blocks || [];

  return (
    <div
      className="ai-info-poster"
      style={{ ['--info-accent' as string]: theme.accent, ['--info-soft' as string]: theme.soft, ['--info-ring' as string]: theme.ring }}
    >
      <header className="ai-info-header">
        <h2 style={{ color: theme.accent }}>{payload.title}</h2>
        {payload.subtitle && <p>{payload.subtitle}</p>}
      </header>
      <div className="ai-info-grid">
        {blocks.map((block, i) => (
          <motion.div
            key={i}
            className={`ai-info-block ${isWide(block) ? 'wide' : ''}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <Block block={block} accent={theme.accent} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default InfographicRenderer;
