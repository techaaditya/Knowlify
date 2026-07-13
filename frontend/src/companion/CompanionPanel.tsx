/**
 * CompanionPanel — the expanded mentor conversation.
 *
 * NotebookLM-inspired: calm layout, grounded source chips, inline practice
 * cards, and proactive quick actions — never a bare chatbot input.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Flame, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { CompanionAvatar } from './CompanionAvatar';
import MarkdownLite from './markdown';
import { useCompanionStore } from './store';
import type { CompanionChatApi } from './useCompanionChat';
import type { CompanionChatMessage, CompanionEmotion } from './types';

const EMOTION_LABEL: Record<CompanionEmotion, string> = {
  idle: 'Here with you',
  happy: 'Glad you’re here',
  thinking: 'Thinking…',
  teaching: 'Teaching',
  celebrating: 'Celebrating!',
  concerned: 'Here to help',
  waiting: 'Welcome back',
  sleeping: 'Resting',
  surprised: 'Oh!',
  confident: 'You’ve got this',
  curious: 'Curious',
};

// ── Inline quiz card ─────────────────────────────────────────────────────────

const QuizCard: React.FC<{ msg: CompanionChatMessage; chat: CompanionChatApi }> = ({ msg, chat }) => {
  const quiz = msg.quiz!;
  const state = msg.quizState;
  return (
    <div className="companion-quiz">
      <div className="companion-quiz-prompt">
        <Sparkles size={13} aria-hidden />
        <span>{quiz.prompt}</span>
      </div>
      <div className="companion-quiz-options">
        {quiz.options.map((opt, i) => {
          const selected = state?.selected === i;
          const showResult = state?.answered && state.isCorrect != null;
          const cls = [
            'companion-quiz-option',
            selected ? 'selected' : '',
            showResult && selected ? (state!.isCorrect ? 'correct' : 'wrong') : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={state?.answered}
              onClick={() => chat.answerQuiz(msg.id, i)}
            >
              <span className="companion-quiz-letter">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
              {showResult && selected && (state!.isCorrect ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />)}
            </button>
          );
        })}
      </div>
      {state?.answered && state.explanation && (
        <div className={`companion-quiz-result ${state.isCorrect ? 'correct' : 'wrong'}`}>
          {!state.isCorrect && state.correctAnswer && (
            <p className="companion-quiz-answer">Correct answer: <strong>{state.correctAnswer}</strong></p>
          )}
          <p>{state.explanation}</p>
        </div>
      )}
    </div>
  );
};

// ── Inline flip flashcards ───────────────────────────────────────────────────

const FlashcardStrip: React.FC<{ cards: NonNullable<CompanionChatMessage['flashcards']> }> = ({ cards }) => {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  return (
    <div className="companion-flashcards">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`companion-flashcard ${flipped[c.id] ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))}
          aria-label={flipped[c.id] ? 'Show question' : 'Reveal answer'}
        >
          <span className="companion-flashcard-tag">{flipped[c.id] ? 'Answer' : 'Tap to reveal'}</span>
          <span>{flipped[c.id] ? c.back : c.front}</span>
        </button>
      ))}
    </div>
  );
};

// ── Progress strip (subtle gamification) ─────────────────────────────────────

const ProgressStrip: React.FC = () => {
  const g = useCompanionStore((s) => s.gamification);
  const [expanded, setExpanded] = useState(false);
  if (!g) return null;
  const unlocked = g.achievements.filter((a) => a.unlocked);
  return (
    <div className="companion-progress">
      <button type="button" className="companion-progress-row" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <span className="companion-level">Lv {g.level} · {g.levelLabel}</span>
        <span className="companion-xpbar" aria-label={`${g.xp} XP`}>
          <motion.span
            className="companion-xpbar-fill"
            animate={{ width: `${Math.round(g.progressToNext * 100)}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </span>
        {g.streakDays > 0 && (
          <span className="companion-streak" title={`${g.streakDays}-day streak`}>
            <Flame size={12} aria-hidden /> {g.streakDays}
          </span>
        )}
        <ChevronDown size={13} className={`companion-progress-chevron ${expanded ? 'open' : ''}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="companion-achievements"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="companion-achievements-inner">
              {g.achievements.map((a) => (
                <span key={a.id} className={`companion-badge ${a.unlocked ? '' : 'locked'}`} title={a.unlocked ? a.label : `${a.label} — ${a.hint}`}>
                  <span aria-hidden>{a.icon}</span> {a.label}
                </span>
              ))}
              <span className="companion-xp-total">{g.xp.toLocaleString()} XP · {unlocked.length}/{g.achievements.length} badges</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── The panel ────────────────────────────────────────────────────────────────

export const CompanionPanel: React.FC<{ chat: CompanionChatApi }> = ({ chat }) => {
  const emotion = useCompanionStore((s) => s.emotion);
  const messages = useCompanionStore((s) => s.messages);
  const sending = useCompanionStore((s) => s.sending);
  const close = useCompanionStore((s) => s.close);
  const clearThread = useCompanionStore((s) => s.clearThread);
  const celebrationToken = useCompanionStore((s) => s.celebrationToken);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quick = useMemo(() => chat.quickActions(), [chat, messages.length]);

  // Personalised greeting on first open.
  useEffect(() => {
    chat.greet();
  }, [chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    chat.send(text);
  };

  return (
    <motion.section
      className="companion-panel"
      role="dialog"
      aria-label="AI learning companion"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      <header className="companion-panel-header">
        <CompanionAvatar emotion={emotion} size={40} celebrationToken={celebrationToken} />
        <div className="companion-panel-title">
          <h2>Mentor</h2>
          <p aria-live="polite">{EMOTION_LABEL[emotion]}</p>
        </div>
        <div className="companion-panel-tools">
          <button type="button" className="companion-icon-btn" onClick={clearThread} aria-label="Start a fresh conversation" title="New conversation">
            <RotateCcw size={15} />
          </button>
          <button type="button" className="companion-icon-btn" onClick={close} aria-label="Minimize companion" title="Minimize">
            <ChevronDown size={17} />
          </button>
        </div>
      </header>

      <ProgressStrip />

      <div className="companion-messages" ref={scrollRef}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            className={`companion-msg ${msg.role}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {msg.role === 'assistant' && (
              <div className="companion-msg-avatar" aria-hidden>
                <CompanionAvatar emotion={msg.emotion ?? 'teaching'} size={26} />
              </div>
            )}
            <div className="companion-msg-body">
              <div className="companion-bubble">
                <MarkdownLite text={msg.content} />
                {msg.quiz && <QuizCard msg={msg} chat={chat} />}
                {msg.flashcards && msg.flashcards.length > 0 && <FlashcardStrip cards={msg.flashcards} />}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="companion-sources" aria-label="Sources used">
                  {msg.sources.map((s, i) => (
                    <span key={i} className="companion-source-chip" title={s.name}>
                      📄 {s.name}
                    </span>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                <div className="companion-actions">
                  {msg.actions.map((a) => (
                    <button key={a.id} type="button" className="companion-chip" onClick={() => chat.runAction(a)} disabled={sending}>
                      {a.icon && <span aria-hidden>{a.icon}</span>} {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {sending && (
          <div className="companion-msg assistant">
            <div className="companion-msg-avatar" aria-hidden>
              <CompanionAvatar emotion="thinking" size={26} />
            </div>
            <div className="companion-bubble companion-typing" aria-label="Companion is thinking">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <footer className="companion-composer">
        {quick.length > 0 && (
          <div className="companion-quick-row" aria-label="Suggested actions">
            {quick.map((a) => (
              <button key={a.id} type="button" className="companion-chip subtle" onClick={() => chat.runAction(a)} disabled={sending}>
                {a.icon && <span aria-hidden>{a.icon}</span>} {a.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="companion-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your mentor anything…"
            aria-label="Message your learning companion"
            disabled={sending}
          />
          <button type="submit" className="companion-send" disabled={sending || !input.trim()} aria-label="Send message">
            <Send size={16} />
          </button>
        </form>
      </footer>
    </motion.section>
  );
};

export default CompanionPanel;
