import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, Lock, MessageCircle, Sparkles, Target } from 'lucide-react';
import type { GraphNode } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';
import { useCompanionChat } from '../../companion/useCompanionChat';
import { useQuizArenaStore } from '../../companion/quizArenaStore';
import {
  NODE_PALETTE,
  categoryFor,
  confidenceFor,
  formatLastRevised,
  formatStudyTime,
  neighborsOf,
  recommendNextId,
  type TopicStat,
} from './graphTheme';

interface Props {
  selectedNode: GraphNode | null;
  allNodes: GraphNode[];
  edges: Array<{ from: string; to: string }>;
  onSelectNode: (id: string) => void;
}

const StatRow: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="kg-stat-row">
    <span>{label}</span>
    <strong style={accent ? { color: accent } : undefined}>{value}</strong>
  </div>
);

export const ConceptSidePanel: React.FC<Props> = ({ selectedNode, allNodes, edges, onSelectNode }) => {
  const studentData = useUserStore((s) => s.studentData);
  const chat = useCompanionChat();
  const launchQuiz = useQuizArenaStore((s) => s.launch);

  const topics = (studentData?.topics ?? {}) as Record<string, TopicStat>;
  const recommendedId = React.useMemo(() => recommendNextId(allNodes, topics), [allNodes, topics]);

  if (!selectedNode) {
    return (
      <aside className="kg-panel kg-panel-empty">
        <div className="kg-panel-empty-inner">
          <span className="kg-panel-empty-icon" aria-hidden>🧠</span>
          <h3>Select a concept</h3>
          <p>Click any node in the graph to see its mastery, prerequisites, and what your mentor recommends next.</p>
        </div>
      </aside>
    );
  }

  const topic = topics[selectedNode.id];
  const category = categoryFor(selectedNode, topics);
  const palette = NODE_PALETTE[category];
  const mastery = Math.round(topic?.mastery_score ?? 0);
  const confidence = confidenceFor(topic);
  const isRecommended = selectedNode.id === recommendedId;
  const isLocked = category === 'locked';
  const { prerequisiteOf, unlocks } = neighborsOf(selectedNode.id, edges);

  const displayNameOf = (id: string) => allNodes.find((n) => n.id === id)?.display_name || id;

  const aiSummary = isLocked
    ? `${selectedNode.display_name} builds on prerequisites you haven't mastered yet. Clear those first and this will unlock automatically.`
    : mastery >= 80
      ? `You've mastered ${selectedNode.display_name}. Your mentor can generate a harder challenge or move you to what it unlocks.`
      : mastery > 0
        ? `You're partway through ${selectedNode.display_name} (${mastery}% mastery). Ask your mentor to explain the parts that aren't sticking, or jump into a quiz to reinforce it.`
        : `You haven't started ${selectedNode.display_name} yet. Your mentor can walk you through it from the ground up.`;

  const askAI = () => {
    chat.runAction({
      id: 'ask-ai',
      intent: 'ask',
      label: 'Ask AI',
      conceptId: selectedNode.id,
      mode: 'explain',
      prompt: `Tell me about ${selectedNode.display_name} — what it is, why it matters, and how it connects to what I already know.`,
    });
  };

  const startLearning = () => {
    chat.runAction({
      id: 'start-learning',
      intent: 'next_lesson',
      label: 'Start learning',
      conceptId: selectedNode.id,
      mode: 'step_by_step',
      prompt: `I'm ready to learn ${selectedNode.display_name}. Teach it to me step by step from the ground up.`,
    });
  };

  const generateSummary = () => {
    chat.runAction({
      id: 'summary',
      intent: 'generate_summary',
      label: 'Generate summary',
      conceptId: selectedNode.id,
      mode: 'explain',
      prompt: `Give me a concise summary of the key points of ${selectedNode.display_name}.`,
    });
  };

  const takeQuiz = () => {
    launchQuiz({ conceptId: selectedNode.id, conceptName: selectedNode.display_name, autoStart: true });
  };

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={selectedNode.id}
        className="kg-panel"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <header className="kg-panel-header">
          <span className="kg-panel-badge" style={{ background: palette.core, color: palette.ring, borderColor: palette.ring }}>
            {isLocked ? <Lock size={11} /> : isRecommended ? <Sparkles size={11} /> : null}
            {isLocked ? 'Locked' : isRecommended ? 'Recommended next' : category === 'mastered' ? 'Mastered' : category === 'weak' ? 'Needs review' : 'Learning'}
          </span>
          <h2>{selectedNode.display_name}</h2>
          <p className="kg-panel-diff">{'●'.repeat(selectedNode.difficulty)}{'○'.repeat(5 - selectedNode.difficulty)} <span>difficulty</span></p>
        </header>

        <p className="kg-panel-desc">{selectedNode.description}</p>

        <section className="kg-panel-section">
          <div className="kg-mastery-row">
            <div className="kg-mastery-ring-wrap">
              <svg viewBox="0 0 64 64" width={56} height={56}>
                <circle cx={32} cy={32} r={26} fill="none" stroke="rgba(59,56,51,0.08)" strokeWidth={6} />
                <motion.circle
                  cx={32} cy={32} r={26} fill="none" stroke={palette.ring} strokeWidth={6} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 26}
                  initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - mastery / 100) }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  transform="rotate(-90 32 32)"
                />
              </svg>
              <span className="kg-mastery-ring-label">{mastery}%</span>
            </div>
            <div className="kg-mastery-meta">
              <span className="kg-panel-label">Mastery</span>
              <p>{confidence != null ? `${confidence}% confidence over ${topic?.total_attempts} attempts` : 'No attempts recorded yet'}</p>
            </div>
          </div>

          <div className="kg-stat-grid">
            <StatRow label="Study time" value={formatStudyTime(topic?.total_time_taken)} />
            <StatRow label="Last studied" value={formatLastRevised(topic?.last_revised)} />
            <StatRow
              label="Recent accuracy"
              value={topic && topic.total_attempts > 0 ? `${topic.correct_answers}/${topic.total_attempts} correct` : '—'}
            />
            <StatRow label="Hints used" value={String(topic?.hints_used ?? 0)} />
          </div>
        </section>

        <section className="kg-panel-section">
          <span className="kg-panel-label">AI insight</span>
          <div className="kg-ai-insight">
            <Lightbulb size={14} aria-hidden />
            <p>{aiSummary}</p>
          </div>
        </section>

        <section className="kg-panel-section kg-rel-section">
          <div>
            <span className="kg-panel-label">Prerequisites</span>
            <div className="kg-rel-list">
              {prerequisiteOf.length === 0 ? (
                <em>None</em>
              ) : (
                prerequisiteOf.map((id) => (
                  <button key={id} type="button" className="kg-rel-chip" onClick={() => onSelectNode(id)}>
                    {displayNameOf(id)}
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <span className="kg-panel-label">Unlocks</span>
            <div className="kg-rel-list">
              {unlocks.length === 0 ? (
                <em>None</em>
              ) : (
                unlocks.map((id) => (
                  <button key={id} type="button" className="kg-rel-chip unlock" onClick={() => onSelectNode(id)}>
                    {displayNameOf(id)}
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <footer className="kg-panel-actions">
          <button type="button" className="kg-action-btn primary" onClick={mastery > 0 ? askAI : startLearning} disabled={isLocked}>
            <MessageCircle size={15} aria-hidden /> {mastery > 0 ? 'Ask AI' : 'Start learning'}
          </button>
          <button type="button" className="kg-action-btn" onClick={takeQuiz} disabled={isLocked}>
            <Target size={15} aria-hidden /> Take quiz
          </button>
          <button type="button" className="kg-action-btn" onClick={generateSummary} disabled={isLocked}>
            <Sparkles size={15} aria-hidden /> Generate summary
          </button>
        </footer>
      </motion.aside>
    </AnimatePresence>
  );
};

export default ConceptSidePanel;
