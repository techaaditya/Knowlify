import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, Info, Search, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { NODE_PALETTE, RECOMMENDED_RING, type NodeCategory } from './graphTheme';
import type { GraphFilterState } from './ConceptGraph';

type FilterKey = NodeCategory | 'recommended';

const FILTER_LABELS: Record<FilterKey, string> = {
  mastered: 'Mastered',
  learning: 'Learning',
  weak: 'Weak',
  locked: 'Locked',
  recommended: 'Recommended',
};

const FILTER_ORDER: FilterKey[] = ['mastered', 'learning', 'weak', 'locked', 'recommended'];

type Popover = 'search' | 'filters' | 'legend' | null;

interface Props {
  filters: GraphFilterState;
  onFiltersChange: (next: GraphFilterState) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export const GraphChrome: React.FC<Props> = ({ filters, onFiltersChange, onZoomIn, onZoomOut, onFit }) => {
  const [open, setOpen] = useState<Popover>(null);

  const toggle = (p: Popover) => setOpen((cur) => (cur === p ? null : p));

  const toggleCategory = (key: FilterKey) => {
    const next = new Set(filters.categories);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onFiltersChange({ ...filters, categories: next });
  };

  const setAll = () => onFiltersChange({ ...filters, categories: new Set(FILTER_ORDER) });

  const activeFilterCount = filters.categories.size < FILTER_ORDER.length ? filters.categories.size : 0;

  return (
    <>
      {/* ── Floating popovers ─────────────────────────────────────────── */}
      <AnimatePresence>
        {open === 'search' && (
          <motion.div
            className="kg-popover kg-popover-search"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <Search size={15} aria-hidden />
            <input
              autoFocus
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              placeholder="Search concepts…"
              aria-label="Search concepts"
            />
            {filters.search && (
              <button type="button" onClick={() => onFiltersChange({ ...filters, search: '' })} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </motion.div>
        )}

        {open === 'filters' && (
          <motion.div
            className="kg-popover kg-popover-filters"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <button type="button" className={`kg-filter-chip ${activeFilterCount === 0 ? 'active' : ''}`} onClick={setAll}>
              All
            </button>
            {FILTER_ORDER.map((key) => {
              const active = filters.categories.has(key);
              const color = key === 'recommended' ? RECOMMENDED_RING : NODE_PALETTE[key].ring;
              return (
                <button
                  key={key}
                  type="button"
                  className={`kg-filter-chip ${active ? 'active' : ''}`}
                  style={active ? { borderColor: color, color } : undefined}
                  onClick={() => toggleCategory(key)}
                >
                  <span className="kg-filter-dot" style={{ background: color }} />
                  {FILTER_LABELS[key]}
                </button>
              );
            })}
          </motion.div>
        )}

        {open === 'legend' && (
          <motion.div
            className="kg-popover kg-popover-legend"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <h4>Legend</h4>
            {FILTER_ORDER.map((key) => (
              <div key={key} className="kg-legend-row">
                <span className="kg-filter-dot" style={{ background: key === 'recommended' ? RECOMMENDED_RING : NODE_PALETTE[key].ring }} />
                <span>{FILTER_LABELS[key]}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom toolbar ────────────────────────────────────────────── */}
      <div className="kg-toolbar">
        <button type="button" className="kg-toolbar-btn" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
          <ZoomIn size={17} />
        </button>
        <button type="button" className="kg-toolbar-btn" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
          <ZoomOut size={17} />
        </button>
        <button type="button" className="kg-toolbar-btn" onClick={onFit} aria-label="Fit to view" title="Fit to view">
          <Maximize2 size={16} />
        </button>
        <span className="kg-toolbar-divider" />
        <button
          type="button"
          className={`kg-toolbar-btn ${open === 'search' ? 'active' : ''}`}
          onClick={() => toggle('search')}
          aria-label="Search concepts"
          title="Search"
        >
          <Search size={16} />
        </button>
        <button
          type="button"
          className={`kg-toolbar-btn ${open === 'filters' ? 'active' : ''}`}
          onClick={() => toggle('filters')}
          aria-label="Filter concepts"
          title="Filters"
        >
          <Filter size={16} />
          {activeFilterCount > 0 && <span className="kg-toolbar-badge">{activeFilterCount}</span>}
        </button>
        <button
          type="button"
          className={`kg-toolbar-btn ${open === 'legend' ? 'active' : ''}`}
          onClick={() => toggle('legend')}
          aria-label="Show legend"
          title="Legend"
        >
          <Info size={16} />
        </button>
      </div>
    </>
  );
};

export default GraphChrome;
