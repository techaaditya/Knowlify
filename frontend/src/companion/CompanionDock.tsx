/**
 * CompanionDock — the companion's permanent home in the lower-right corner.
 *
 * Renders the living avatar button, the proactive nudge bubble, and the
 * expandable chat panel. Mount once inside the authenticated app; it wires
 * its own senses (useCompanionData) and voice (useCompanionChat).
 */
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { CompanionAvatar } from './CompanionAvatar';
import { CompanionPanel } from './CompanionPanel';
import { QuizArena } from './QuizArena';
import { useQuizArenaStore } from './quizArenaStore';
import { useCompanionData } from './useCompanionData';
import { useCompanionChat } from './useCompanionChat';
import { useCompanionStore } from './store';
import './companion.css';

// Dev-only escape hatch: lets you preview emotions from the console, e.g.
//   __companion.setEmotion('celebrating')
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__companion = useCompanionStore.getState();
  useCompanionStore.subscribe((state) => {
    (window as unknown as Record<string, unknown>).__companion = state;
  });
}

export const CompanionDock: React.FC = () => {
  useCompanionData(); // senses: stores + dashboard engine → snapshot/emotion/nudges

  const chat = useCompanionChat();
  const isOpen = useCompanionStore((s) => s.isOpen);
  const emotion = useCompanionStore((s) => s.emotion);
  const nudge = useCompanionStore((s) => s.activeNudge);
  const dismissNudge = useCompanionStore((s) => s.dismissNudge);
  const toggle = useCompanionStore((s) => s.toggle);
  const celebrationToken = useCompanionStore((s) => s.celebrationToken);

  const runNudgeAction = (actionId: string) => {
    const action = nudge?.actions?.find((a) => a.id === actionId);
    dismissNudge();
    // runAction decides whether to open the chat or launch the full-screen quiz.
    if (action) chat.runAction(action);
  };

  const quizOpen = useQuizArenaStore((s) => s.open);

  return (
    <div className="companion-dock">
      <AnimatePresence>{quizOpen && <QuizArena chat={chat} />}</AnimatePresence>
      <AnimatePresence>{isOpen && <CompanionPanel chat={chat} />}</AnimatePresence>

      {/* Proactive nudge bubble */}
      <AnimatePresence>
        {!isOpen && nudge && (
          <motion.aside
            key={nudge.id}
            className={`companion-nudge emotion-${nudge.emotion}`}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          >
            <button
              type="button"
              className="companion-nudge-close"
              onClick={() => dismissNudge({ remember: true })}
              aria-label="Dismiss suggestion"
            >
              <X size={12} />
            </button>
            <p>{nudge.text}</p>
            {nudge.actions && nudge.actions.length > 0 && (
              <div className="companion-nudge-actions">
                {nudge.actions.map((a) => (
                  <button key={a.id} type="button" className="companion-chip" onClick={() => runNudgeAction(a.id)}>
                    {a.icon && <span aria-hidden>{a.icon}</span>} {a.label}
                  </button>
                ))}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* The living avatar button */}
      <motion.button
        type="button"
        className={`companion-fab ${isOpen ? 'open' : ''}`}
        onClick={() => {
          if (nudge) dismissNudge();
          toggle();
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? 'Minimize your learning companion' : 'Open your learning companion'}
        aria-expanded={isOpen}
      >
        <CompanionAvatar emotion={emotion} size={58} celebrationToken={celebrationToken} />
      </motion.button>
    </div>
  );
};

export default CompanionDock;
