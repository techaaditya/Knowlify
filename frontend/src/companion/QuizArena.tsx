/**
 * QuizArena — the companion's full-screen, focused quiz experience.
 *
 * Launched from a "Quiz me" / "Challenge me" action, it takes over the screen:
 * a calm setup step, one large question at a time with graded feedback, and a
 * celebratory results recap. The mentor orb sits in the header and reacts live
 * (thinking → teaching → celebrating / concerned) so a quiz feels like being
 * coached, not tested. Backed by the real quiz-generation endpoints.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, PenTool, RotateCcw, Sparkles, Target, X } from 'lucide-react';
import { useQuizSession, type QuizReviewItem } from '../components/shared/useQuizSession';
import { ConceptPicker } from '../components/shared/ConceptPicker';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { CompanionAvatar } from './CompanionAvatar';
import { humanizeConcept, norm01, pct } from './brain';
import { useCompanionStore } from './store';
import { useQuizArenaStore, type QuizDifficulty, type QuizMode } from './quizArenaStore';
import { useCanvasLaunchStore } from '../components/AICanvas/canvasLaunchStore';
import type { CompanionChatApi } from './useCompanionChat';

const DIFFICULTIES: QuizDifficulty[] = ['Easy', 'Medium', 'Hard'];
const MODES: { id: QuizMode; label: string }[] = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'mcq', label: 'Multiple choice' },
  { id: 'short_answer', label: 'Short answer' },
];

// Grade → mentor emotion + line for the results screen.
const resultMood = (ratio: number): { emotion: 'celebrating' | 'happy' | 'confident' | 'concerned'; line: string } => {
  if (ratio >= 0.9) return { emotion: 'celebrating', line: "Outstanding — you're mastering this! 🎉" };
  if (ratio >= 0.7) return { emotion: 'confident', line: 'Strong work. A couple to polish and you’ve got it.' };
  if (ratio >= 0.4) return { emotion: 'happy', line: 'Good effort — let’s review the tricky ones together.' };
  return { emotion: 'concerned', line: 'No worries at all. This is exactly how we find what to work on.' };
};

const ScoreRing: React.FC<{ ratio: number; label: string }> = ({ ratio, label }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="quiz-score-ring">
      <svg viewBox="0 0 120 120" width={132} height={132}>
        <circle cx={60} cy={60} r={r} fill="none" stroke="var(--border-faint)" strokeWidth={10} />
        <motion.circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke="var(--swatch-4)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ duration: 1, ease: 'easeOut' }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="quiz-score-ring-label">
        <strong>{label}</strong>
        <span>{Math.round(ratio * 100)}%</span>
      </div>
    </div>
  );
};

export const QuizArena: React.FC<{ chat: CompanionChatApi }> = ({ chat }) => {
  const arena = useQuizArenaStore();
  const graphData = useStudyStore((s) => s.graphData);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const studentData = useUserStore((s) => s.studentData);

  const setEmotion = useCompanionStore((s) => s.setEmotion);
  const celebrate = useCompanionStore((s) => s.celebrate);
  const arenaEmotion = useCompanionStore((s) => s.emotion);
  const launchCanvas = useCanvasLaunchStore((s) => s.launch);

  const nodes = graphData?.nodes ?? [];

  const [conceptId, setConceptId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [mode, setMode] = useState<QuizMode>('mixed');

  // The one shared quiz state machine; the arena only adds mentor emotions.
  const session = useQuizSession({
    onGenerated: () => setEmotion('teaching', 4000),
    onAnswered: (correct) => setEmotion(correct ? 'celebrating' : 'concerned', 2200),
    onComplete: (finalRatio) => {
      const mood = resultMood(finalRatio);
      setEmotion(mood.emotion, mood.emotion === 'celebrating' ? 6000 : 4000);
      if (finalRatio >= 0.7) celebrate();
    },
  });
  const {
    questions, index, question, score, feedback, error, submitting,
    selectedOption, setSelectedOption, answerText, setAnswerText,
  } = session;
  const phase = session.phase === 'idle' ? 'setup' : session.phase;

  const conceptName =
    nodes.find((n) => n.id === conceptId)?.display_name || arena.conceptName || humanizeConcept(conceptId);
  const mastery = studentData?.topics?.[conceptId]?.mastery_score;

  // ── Sync launch options into local setup state on each new session ────────
  useEffect(() => {
    session.reset();
    setDifficulty(arena.difficulty);
    setMode(arena.questionMode);
    const preferred =
      (arena.conceptId && nodes.some((n) => n.id === arena.conceptId) ? arena.conceptId : '') ||
      arena.conceptId ||
      nodes[0]?.id ||
      '';
    setConceptId(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.sessionKey]);

  const generate = useCallback(
    async (targetConcept: string, targetDifficulty: QuizDifficulty, targetMode: QuizMode) => {
      if (!workspace?.id || !targetConcept) return;
      setEmotion('thinking');
      await session.generate(targetConcept, targetMode, targetDifficulty);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace?.id, setEmotion, session.generate],
  );

  // A failed generation drops the session back to setup — mirror the mood.
  useEffect(() => {
    if (error && phase === 'setup') setEmotion('concerned', 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Auto-start when launched with a concept in hand.
  useEffect(() => {
    if (arena.open && arena.autoStart && phase === 'setup' && conceptId) {
      generate(conceptId, arena.difficulty, arena.questionMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.sessionKey, conceptId]);

  const submit = () => {
    setEmotion('thinking');
    session.submit(difficulty);
  };

  const next = () => {
    const completing = index + 1 >= questions.length;
    session.next();
    if (!completing) setEmotion('teaching', 3500);
  };

  const openCanvasForMistake = () => {
    if (!question || !feedback) return;
    launchCanvas({
      conceptId: question.concept_id || conceptId,
      conceptName,
      prompt: [
        `I got this quiz question about ${conceptName} wrong.`,
        `Question: ${question.prompt}`,
        `Correct answer: ${feedback.answer}`,
        'Visually walk me through why the correct answer is right.',
      ].join('\n'),
    });
  };

  const learnMore = (item: QuizReviewItem) => {
    const prompt = [
      `Explain this quiz question about ${item.question.concept_id ? humanizeConcept(item.question.concept_id) : conceptName}.`,
      `Question: ${item.question.prompt}`,
      `My answer: ${item.selectedAnswer || 'No answer recorded'}`,
      `Correct answer: ${item.correctAnswer}`,
      `Result: ${item.isCorrect ? 'I got it right' : 'I got it wrong'}.`,
      'Explain why the correct answer is right and what I should remember next time.',
    ].join('\n');
    arena.close();
    chat.explain(prompt, { conceptId: item.question.concept_id });
  };

  const close = useCallback(() => arena.close(), [arena]);

  // Escape closes the arena.
  useEffect(() => {
    if (!arena.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [arena.open, close]);

  const ratio = questions.length ? score / questions.length : 0;
  const mood = useMemo(() => resultMood(ratio), [ratio]);

  if (!arena.open) return null;

  return (
    <motion.div
      className="quiz-arena"
      role="dialog"
      aria-modal="true"
      aria-label="Practice quiz"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="quiz-arena-backdrop" />

      <motion.div
        className="quiz-arena-shell"
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        {/* Header */}
        <header className="quiz-arena-header">
          <div className="quiz-arena-mentor">
            <CompanionAvatar emotion={arenaEmotion} size={44} />
            <div>
              <h2>Practice Quiz</h2>
              <p>{phase === 'setup' ? 'Set up by your mentor' : conceptName}</p>
            </div>
          </div>
          {phase === 'active' && (
            <div className="quiz-arena-progress-meta" aria-label={`Question ${index + 1} of ${questions.length}`}>
              <span className="quiz-arena-qcount">
                {index + 1} <span>/ {questions.length}</span>
              </span>
              <span className="quiz-arena-score">
                <Target size={13} aria-hidden /> {score} correct
              </span>
            </div>
          )}
          <button type="button" className="quiz-arena-close" onClick={close} aria-label="Exit quiz">
            <X size={20} />
          </button>
        </header>

        {phase === 'active' && (
          <div className="quiz-arena-progress-track" aria-hidden>
            <motion.div
              className="quiz-arena-progress-fill"
              animate={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </div>
        )}

        <div className="quiz-arena-body">
          <AnimatePresence mode="wait">
            {/* ── Setup ──────────────────────────────────────────── */}
            {phase === 'setup' && (
              <motion.div
                key="setup"
                className="quiz-setup"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                {nodes.length === 0 ? (
                  <div className="quiz-empty">
                    <span className="quiz-empty-icon" aria-hidden>🗺️</span>
                    <h3>No concepts to quiz yet</h3>
                    <p>Add and process a source so I can build a knowledge map — then I can quiz you on any concept in it.</p>
                    <button type="button" className="btn btn-primary" onClick={close}>Got it</button>
                  </div>
                ) : (
                  <>
                    <div className="quiz-setup-intro">
                      <Sparkles size={16} aria-hidden />
                      <p>Pick what you want to be tested on. I’ll adapt the questions to your knowledge graph.</p>
                    </div>

                    <label className="quiz-field">
                      <span>Concept</span>
                      <ConceptPicker
                        value={conceptId}
                        onChange={setConceptId}
                        syncSelectedNode={false}
                        className="quiz-select"
                      />
                    </label>

                    <div className="quiz-field">
                      <span>Difficulty</span>
                      <div className="quiz-segmented">
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={difficulty === d ? 'active' : ''}
                            onClick={() => setDifficulty(d)}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="quiz-field">
                      <span>Question type</span>
                      <div className="quiz-segmented">
                        {MODES.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={mode === m.id ? 'active' : ''}
                            onClick={() => setMode(m.id)}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {mastery != null && (
                      <p className="quiz-mastery-note">
                        Current mastery of <strong>{conceptName}</strong>: {pct(norm01(mastery))}%. Harder questions move it more.
                      </p>
                    )}
                    {error && <p className="quiz-error">{error}</p>}

                    <button type="button" className="quiz-start-btn" onClick={() => generate(conceptId, difficulty, mode)}>
                      Start quiz <ArrowRight size={17} aria-hidden />
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {/* ── Loading ────────────────────────────────────────── */}
            {phase === 'loading' && (
              <motion.div key="loading" className="quiz-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CompanionAvatar emotion="thinking" size={72} />
                <p>Crafting your questions on <strong>{conceptName}</strong>…</p>
              </motion.div>
            )}

            {/* ── Active question ────────────────────────────────── */}
            {phase === 'active' && question && (
              <motion.div
                key={`q-${question.id}`}
                className="quiz-question"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <div className="quiz-question-tags">
                  <span className={`quiz-diff-badge diff-${question.difficulty?.toLowerCase?.() || 'medium'}`}>{question.difficulty}</span>
                  {question.source_name && <span className="quiz-source-badge">📄 {question.source_name}</span>}
                </div>

                <h3 className="quiz-prompt">{question.prompt}</h3>

                {question.question_type === 'multiple_choice' ? (
                  <div className="quiz-options">
                    {question.options.map((opt, i) => {
                      const isSel = selectedOption === i;
                      const showR = Boolean(feedback);
                      const correct = showR && feedback!.answer === opt;
                      const wrongPick = showR && isSel && !feedback!.correct;
                      const cls = ['quiz-option', isSel ? 'selected' : '', correct ? 'correct' : '', wrongPick ? 'wrong' : '']
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <button key={`${question.id}-${i}`} type="button" className={cls} disabled={showR} onClick={() => setSelectedOption(i)}>
                          <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                          <span className="quiz-option-text">{opt}</span>
                          {correct && <Check size={18} aria-hidden />}
                          {wrongPick && <X size={18} aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    className="quiz-textarea"
                    value={answerText}
                    disabled={Boolean(feedback)}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer, using what you remember from the source…"
                  />
                )}

                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      className={`quiz-feedback ${feedback.correct ? 'correct' : 'wrong'}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <strong>{feedback.correct ? '✓ Correct!' : '✕ Not quite'}</strong>
                      {!feedback.correct && <p className="quiz-feedback-answer">Correct answer: {feedback.answer}</p>}
                      <p>{feedback.explanation}</p>
                      {!feedback.correct && (
                        <button type="button" className="companion-chip subtle" onClick={openCanvasForMistake}>
                          <PenTool size={13} aria-hidden /> See it on the AI Canvas
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && <p className="quiz-error">{error}</p>}

                <div className="quiz-actions">
                  {!feedback ? (
                    <button
                      type="button"
                      className="quiz-start-btn"
                      disabled={(question.question_type === 'multiple_choice' ? selectedOption === null : !answerText.trim()) || submitting}
                      onClick={submit}
                    >
                      {submitting ? 'Checking…' : 'Submit answer'}
                    </button>
                  ) : (
                    <button type="button" className="quiz-start-btn" onClick={next}>
                      {index + 1 >= questions.length ? 'See results' : 'Next question'} <ArrowRight size={17} aria-hidden />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Results ────────────────────────────────────────── */}
            {phase === 'complete' && (
              <motion.div key="complete" className="quiz-complete" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="quiz-complete-hero">
                  <ScoreRing ratio={ratio} label={`${score}/${questions.length}`} />
                  <div className="quiz-complete-mentor">
                    <CompanionAvatar emotion={mood.emotion} size={56} celebrationToken={ratio >= 0.7 ? 1 : 0} />
                    <p>{mood.line}</p>
                  </div>
                </div>

                <div className="quiz-review">
                  <h4>Review</h4>
                  {session.reviewItems
                    .map((item) => (
                      <div key={item.question.id} className={`quiz-review-item ${item.isCorrect ? 'correct' : 'wrong'}`}>
                        <div className="quiz-review-head">
                          <span className="quiz-review-badge">{item.isCorrect ? '✓' : '✕'} Q{item.questionNumber}</span>
                          <p className="quiz-review-prompt">{item.question.prompt}</p>
                        </div>
                        <p className="quiz-review-line"><span>Your answer:</span> {item.selectedAnswer || '—'}</p>
                        {!item.isCorrect && <p className="quiz-review-line"><span>Correct:</span> {item.correctAnswer}</p>}
                        <button type="button" className="companion-chip subtle" onClick={() => learnMore(item)}>
                          💡 Explain this
                        </button>
                      </div>
                    ))}
                </div>

                <div className="quiz-complete-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => generate(conceptId, difficulty, mode)}>
                    <RotateCcw size={15} aria-hidden /> Retry concept
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => session.reset()}>New quiz</button>
                  <button type="button" className="quiz-start-btn" onClick={close}>Done</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QuizArena;
