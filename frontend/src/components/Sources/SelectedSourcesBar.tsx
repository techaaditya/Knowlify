import React from 'react';
import { useSourcesStore } from '../../store/sourcesStore';

export const SelectedSourcesBar: React.FC = () => {
  const selected = useSourcesStore((s) => s.getSelectedSources());
  const selectAll = useSourcesStore((s) => s.selectAllCompleted);
  const clearSelection = useSourcesStore((s) => s.clearSelection);
  if (selected.length === 0) {
    return (
      <div className="selected-sources-bar empty">
        <span>No sources selected.</span>
        <button className="btn-link" onClick={selectAll}>Select all completed sources</button>
      </div>
    );
  }

  return (
    <div className="selected-sources-bar">
      <div className="selected-sources-info">
        <span className="selected-count">{selected.length} source{selected.length !== 1 ? 's' : ''} active</span>
        <span className="selected-hint">Chat, graph, and quiz use your selected sources</span>
      </div>
      <div className="selected-sources-chips">
        {selected.slice(0, 4).map((s) => (
          <span key={s.id} className="selected-source-chip">{s.source_name}</span>
        ))}
        {selected.length > 4 && (
          <span className="selected-source-chip more">+{selected.length - 4} more</span>
        )}
      </div>
      <div className="selected-sources-actions">
        <button className="btn-link" onClick={selectAll}>Select all</button>
        <button className="btn-link" onClick={clearSelection}>Clear</button>
      </div>
    </div>
  );
};
