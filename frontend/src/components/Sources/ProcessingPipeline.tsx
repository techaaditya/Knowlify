import React from 'react';

const STAGES = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'chunking', label: 'Chunking' },
  { key: 'entity_extraction', label: 'Entity Extraction' },
  { key: 'relationship_discovery', label: 'Relationship Discovery' },
  { key: 'graph_construction', label: 'Graph Construction' },
  { key: 'ready', label: 'Ready' },
];

interface Props {
  currentStage?: string;
  progress: number;
  status: string;
}

export const ProcessingPipeline: React.FC<Props> = ({ currentStage, progress, status }) => {
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="processing-pipeline">
      <div className="pipeline-progress-bar">
        <div
          className="pipeline-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="pipeline-stages">
        {STAGES.map((stage, idx) => {
          const isActive = stage.key === currentStage;
          const isDone =
            status === 'completed' ||
            (currentIdx >= 0 && idx < currentIdx) ||
            (status === 'completed' && stage.key === 'ready');
          const isFailed = status === 'failed' && isActive;

          return (
            <div
              key={stage.key}
              className={`pipeline-stage ${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${isFailed ? 'failed' : ''}`}
            >
              <div className="pipeline-stage-dot" />
              <span className="pipeline-stage-label">{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
