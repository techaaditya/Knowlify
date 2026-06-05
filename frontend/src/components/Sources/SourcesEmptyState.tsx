import React from 'react';

interface Props {
  onAddSources: () => void;
  onDrop: (files: FileList) => void;
}

const SOURCE_CARDS = [
  { icon: '📄', title: 'Documents', desc: 'PDF, DOCX, PPTX, TXT, Markdown' },
  { icon: '🌐', title: 'Website', desc: 'Import articles and webpages' },
  { icon: '▶️', title: 'YouTube', desc: 'Educational videos via transcripts' },
  { icon: '✏️', title: 'Notes', desc: 'Paste research notes or summaries' },
];

export const SourcesEmptyState: React.FC<Props> = ({ onAddSources, onDrop }) => {
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <div
      className={`sources-empty-state ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files);
      }}
    >
      <div className="empty-state-content">
        <div className="empty-state-icon">🧠</div>
        <h2>Build Your Knowledge Base</h2>
        <p>
          Import documents, websites, videos, and notes to create a connected
          AI-powered knowledge graph.
        </p>
        <button className="btn btn-primary" onClick={onAddSources}>
          Add Your First Source
        </button>
      </div>

      <div className="empty-state-cards">
        {SOURCE_CARDS.map((card) => (
          <div key={card.title} className="empty-source-card" onClick={onAddSources}>
            <span className="empty-source-icon">{card.icon}</span>
            <h4>{card.title}</h4>
            <p>{card.desc}</p>
          </div>
        ))}
      </div>

      <p className="empty-drop-hint">Or drag and drop files anywhere on this page</p>
    </div>
  );
};
