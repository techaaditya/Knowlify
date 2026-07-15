import React from 'react';
import { motion } from 'framer-motion';
import { useCanvasSessionStore } from './canvasSessionStore';

export const CanvasInspector: React.FC = () => {
  const scene = useCanvasSessionStore((s) => s.scene);
  const stepIndex = useCanvasSessionStore((s) => s.stepIndex);
  const history = useCanvasSessionStore((s) => s.history);
  const fallbackText = useCanvasSessionStore((s) => s.fallbackText);
  const error = useCanvasSessionStore((s) => s.error);

  if (!scene && !fallbackText && !error) return null;

  const currentStep = scene?.steps[stepIndex];

  return (
    <motion.aside
      className="ai-canvas-inspector"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18 }}
    >
      <div className="ai-canvas-inspector-label">Canvas Inspector</div>
      {error && <p className="ai-canvas-inspector-error">{error}</p>}
      {fallbackText && !scene && <p>{fallbackText}</p>}
      {scene && (
        <>
          <h3>{scene.title}</h3>
          <p>
            Step {stepIndex + 1} of {scene.steps.length} · {scene.visualization}
          </p>
          {currentStep?.narration && <p>{currentStep.narration}</p>}
          <div className="ai-canvas-inspector-meta">
            <span>{history.length} scenes this session</span>
          </div>
        </>
      )}
    </motion.aside>
  );
};

export default CanvasInspector;
