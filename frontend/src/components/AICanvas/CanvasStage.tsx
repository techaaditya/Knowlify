import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles } from 'lucide-react';
import { useCanvasSessionStore } from './canvasSessionStore';
import { GraphRenderer } from './renderers/GraphRenderer';
import { EquationRenderer } from './renderers/EquationRenderer';
import { ComparisonRenderer } from './renderers/ComparisonRenderer';
import { TimelineRenderer } from './renderers/TimelineRenderer';

export const CanvasStage: React.FC = () => {
  const scene = useCanvasSessionStore((s) => s.scene);
  const stepIndex = useCanvasSessionStore((s) => s.stepIndex);
  const loading = useCanvasSessionStore((s) => s.loading);
  const error = useCanvasSessionStore((s) => s.error);
  const fallbackText = useCanvasSessionStore((s) => s.fallbackText);
  const playing = useCanvasSessionStore((s) => s.playing);
  const nextStep = useCanvasSessionStore((s) => s.nextStep);
  const prevStep = useCanvasSessionStore((s) => s.prevStep);
  const goToStep = useCanvasSessionStore((s) => s.goToStep);
  const togglePlay = useCanvasSessionStore((s) => s.togglePlay);

  if (loading) {
    return (
      <div className="ai-canvas-empty">
        <span className="ai-canvas-empty-spinner" aria-hidden />
        <p>Your mentor is sketching this out…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-canvas-empty">
        <span className="ai-canvas-empty-icon" aria-hidden>⚠️</span>
        <h3>Couldn't build the canvas</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (fallbackText) {
    return (
      <div className="ai-canvas-fallback">
        <p>{fallbackText}</p>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="ai-canvas-empty">
        <span className="ai-canvas-empty-icon" aria-hidden>🎨</span>
        <h3>Ask your mentor to teach something</h3>
        <p>Type a concept below — Binary Search, SQL joins, neural networks — and watch it get sketched out step by step.</p>
      </div>
    );
  }

  const step = scene.steps[stepIndex];
  const total = scene.steps.length;

  return (
    <div className="ai-canvas-stage">
      <div className="ai-canvas-visual">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="ai-canvas-visual-inner"
          >
            {scene.visualization === 'graph' && step.graph && <GraphRenderer payload={step.graph} />}
            {scene.visualization === 'equation' && step.equation && <EquationRenderer payload={step.equation} />}
            {scene.visualization === 'comparison' && step.comparison && <ComparisonRenderer payload={step.comparison} />}
            {scene.visualization === 'timeline' && step.timeline && <TimelineRenderer payload={step.timeline} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="ai-canvas-narration-bar">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            className="ai-canvas-narration"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <Sparkles size={14} aria-hidden />
            {step.narration}
          </motion.p>
        </AnimatePresence>

        <div className="ai-canvas-step-controls">
          <button type="button" className="ai-canvas-step-btn" onClick={prevStep} disabled={stepIndex === 0} aria-label="Previous step">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="ai-canvas-step-btn primary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            className="ai-canvas-step-btn"
            onClick={nextStep}
            disabled={stepIndex + 1 >= total}
            aria-label="Next step"
          >
            <ChevronRight size={16} />
          </button>
          <div className="ai-canvas-step-dots" role="tablist" aria-label="Steps">
            {scene.steps.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === stepIndex}
                className={`ai-canvas-step-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
                onClick={() => goToStep(i)}
                aria-label={`Step ${i + 1} of ${total}`}
              />
            ))}
          </div>
          <span className="ai-canvas-step-count">{stepIndex + 1} / {total}</span>
        </div>
      </div>
    </div>
  );
};

export default CanvasStage;
