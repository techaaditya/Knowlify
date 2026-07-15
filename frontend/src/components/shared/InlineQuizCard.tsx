/**
 * InlineQuizCard — the one single-question quiz card embedded in a chat
 * bubble (tutor chat and companion). Presentational: the caller owns the
 * answer call and passes back the result.
 */
import React from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import './shared.css';

export interface InlineQuizResult {
  isCorrect: boolean;
  explanation: string;
  correctAnswer?: string;
}

interface InlineQuizCardProps {
  prompt: string;
  options: string[];
  answered: boolean;
  selected: number | null;
  result?: InlineQuizResult | null;
  onAnswer: (optionIndex: number) => void;
  disabled?: boolean;
}

export const InlineQuizCard: React.FC<InlineQuizCardProps> = ({
  prompt,
  options,
  answered,
  selected,
  result,
  onAnswer,
  disabled,
}) => (
  <div className="inline-quiz">
    <div className="inline-quiz-prompt">
      <Sparkles size={13} aria-hidden />
      <span>{prompt}</span>
    </div>
    <div className="inline-quiz-options">
      {options.map((opt, i) => {
        const isSelected = selected === i;
        const showResult = answered && result != null;
        const cls = [
          'inline-quiz-option',
          isSelected ? 'selected' : '',
          showResult && isSelected ? (result!.isCorrect ? 'correct' : 'wrong') : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={i}
            type="button"
            className={cls}
            disabled={answered || disabled}
            onClick={() => onAnswer(i)}
          >
            <span className="inline-quiz-letter">{String.fromCharCode(65 + i)}</span>
            <span>{opt}</span>
            {showResult && isSelected && (result!.isCorrect ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />)}
          </button>
        );
      })}
    </div>
    {answered && result?.explanation && (
      <div className={`inline-quiz-result ${result.isCorrect ? 'correct' : 'wrong'}`}>
        {!result.isCorrect && result.correctAnswer && (
          <p className="inline-quiz-answer">
            Correct answer: <strong>{result.correctAnswer}</strong>
          </p>
        )}
        <p>{result.explanation}</p>
      </div>
    )}
  </div>
);

export default InlineQuizCard;
