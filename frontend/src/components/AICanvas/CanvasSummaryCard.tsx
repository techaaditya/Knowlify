import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BookOpen, Clock, Sigma, Target, X } from 'lucide-react';
import { useCanvasSessionStore } from './canvasSessionStore';
import { useStudyStore } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';
import { useQuizArenaStore } from '../../companion/quizArenaStore';
import { humanizeConcept } from '../../companion/brain';
import { recommendNextId, type TopicStat } from '../KnowledgeMap/graphTheme';

interface Props {
  onClose: () => void;
}

const formatDuration = (ms: number): string => {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
};

/**
 * End-of-session recap built entirely from what actually happened in this
 * session — no fabricated metrics. Deliberately does NOT include an
 * "estimated memory retention" figure: there's no spaced-repetition/forgetting
 * model backing that number for canvas sessions, so showing one would just be
 * a made-up statistic dressed as data.
 */
export const CanvasSummaryCard: React.FC<Props> = ({ onClose }) => {
  const history = useCanvasSessionStore((s) => s.history);
  const sessionStartedAt = useCanvasSessionStore((s) => s.sessionStartedAt);
  const graphData = useStudyStore((s) => s.graphData);
  const studentData = useUserStore((s) => s.studentData);
  const launchQuiz = useQuizArenaStore((s) => s.launch);

  const topics = useMemo(() => Array.from(new Set(history.map((h) => h.scene.title))), [history]);

  const equations = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => h.scene.steps.forEach((s) => s.equation?.latex && set.add(s.equation.latex)));
    return Array.from(set).slice(0, 6);
  }, [history]);

  const mistakes = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => h.misconceptions.forEach((m) => set.add(m)));
    return Array.from(set);
  }, [history]);

  const lastConcept = history.length > 0 ? history[history.length - 1] : null;

  const nextTopic = useMemo(() => {
    if (!graphData?.nodes?.length) return null;
    const topics2 = (studentData?.topics ?? {}) as Record<string, TopicStat>;
    const id = recommendNextId(graphData.nodes, topics2);
    if (!id) return null;
    const node = graphData.nodes.find((n) => n.id === id);
    return node ? { id, name: node.display_name } : null;
  }, [graphData, studentData]);

  const duration = formatDuration(Date.now() - sessionStartedAt);

  const startQuiz = () => {
    if (!lastConcept?.conceptId) return;
    launchQuiz({ conceptId: lastConcept.conceptId, conceptName: lastConcept.scene.title, autoStart: true });
  };

  return (
    <motion.div
      className="ai-canvas-summary-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="ai-canvas-summary-card"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <header>
          <h2>Session Summary</h2>
          <button type="button" onClick={onClose} aria-label="Close summary"><X size={18} /></button>
        </header>

        {topics.length === 0 ? (
          <p className="ai-canvas-summary-empty">Nothing was taught on the canvas yet this session.</p>
        ) : (
          <div className="ai-canvas-summary-body">
            <section>
              <h3><BookOpen size={14} aria-hidden /> Topics covered</h3>
              <div className="ai-canvas-summary-chips">
                {topics.map((t) => <span key={t} className="ai-canvas-summary-chip">{t}</span>)}
              </div>
            </section>

            {equations.length > 0 && (
              <section>
                <h3><Sigma size={14} aria-hidden /> Key equations</h3>
                <ul className="ai-canvas-summary-list mono">
                  {equations.map((eq, i) => <li key={i}>{eq}</li>)}
                </ul>
              </section>
            )}

            {mistakes.length > 0 && (
              <section>
                <h3><AlertTriangle size={14} aria-hidden /> Common mistakes flagged</h3>
                <ul className="ai-canvas-summary-list">
                  {mistakes.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </section>
            )}

            <section className="ai-canvas-summary-stats">
              <div>
                <Clock size={14} aria-hidden />
                <span>Study duration</span>
                <strong>{duration}</strong>
              </div>
              {nextTopic && (
                <div>
                  <Target size={14} aria-hidden />
                  <span>Recommended next</span>
                  <strong>{nextTopic.name || humanizeConcept(nextTopic.id)}</strong>
                </div>
              )}
            </section>

            {lastConcept?.conceptId && (
              <button type="button" className="ai-canvas-summary-quiz-btn" onClick={startQuiz}>
                Take a quiz on {lastConcept.scene.title}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default CanvasSummaryCard;
