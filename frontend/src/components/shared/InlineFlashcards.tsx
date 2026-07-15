/**
 * InlineFlashcards — the one tap-to-flip flashcard strip embedded in a chat
 * bubble (tutor chat and companion). Optionally lets the learner self-report
 * each card via `onRate`.
 */
import React, { useState } from 'react';
import './shared.css';

interface InlineFlashcardsProps {
  cards: Array<{ id: string; front: string; back: string }>;
  /** When provided, a Know / Review row appears once a card is revealed. */
  onRate?: (cardId: string, known: boolean) => void;
}

export const InlineFlashcards: React.FC<InlineFlashcardsProps> = ({ cards, onRate }) => {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [rated, setRated] = useState<Record<string, boolean>>({});

  return (
    <div className="inline-flashcards">
      {cards.map((c) => (
        <div key={c.id} className="inline-flashcard-wrap">
          <button
            type="button"
            className={`inline-flashcard ${flipped[c.id] ? 'flipped' : ''}`}
            onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))}
            aria-label={flipped[c.id] ? 'Show question' : 'Reveal answer'}
          >
            <span className="inline-flashcard-tag">{flipped[c.id] ? 'Answer' : 'Tap to reveal'}</span>
            <span>{flipped[c.id] ? c.back : c.front}</span>
          </button>
          {onRate && flipped[c.id] && !rated[c.id] && (
            <div className="inline-flashcard-rate">
              <button
                type="button"
                className="inline-flashcard-rate-btn know"
                onClick={() => {
                  setRated((r) => ({ ...r, [c.id]: true }));
                  onRate(c.id, true);
                }}
              >
                I knew it
              </button>
              <button
                type="button"
                className="inline-flashcard-rate-btn review"
                onClick={() => {
                  setRated((r) => ({ ...r, [c.id]: true }));
                  onRate(c.id, false);
                }}
              >
                Review again
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default InlineFlashcards;
