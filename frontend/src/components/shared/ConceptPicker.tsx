/**
 * ConceptPicker — the one concept dropdown for every surface that targets a
 * concept from the workspace knowledge graph (quiz, flashcards, written
 * material, tutor chat, quiz arena). Reads the graph from the study store so
 * callers only manage the selected value.
 */
import React from 'react';
import { useStudyStore } from '../../store/studyStore';

interface ConceptPickerProps {
  value: string;
  onChange: (conceptId: string) => void;
  /** Adds a "General Chat (All Sources)" empty-value option (tutor chat). */
  allowGeneral?: boolean;
  /** Also sync the global selected graph node (default true). */
  syncSelectedNode?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export const ConceptPicker: React.FC<ConceptPickerProps> = ({
  value,
  onChange,
  allowGeneral = false,
  syncSelectedNode = true,
  id,
  className,
  disabled,
  'aria-label': ariaLabel,
}) => {
  const graphData = useStudyStore((state) => state.graphData);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);

  if (!graphData?.nodes.length) return null;

  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => {
        const conceptId = event.target.value;
        if (syncSelectedNode) setSelectedNodeId(conceptId || null);
        onChange(conceptId);
      }}
    >
      {allowGeneral && <option value="">💬 General Chat (All Sources)</option>}
      {graphData.nodes.map((node) => (
        <option key={node.id} value={node.id}>
          {node.display_name}
        </option>
      ))}
    </select>
  );
};

export default ConceptPicker;
