/**
 * useQuizSession — the one quiz state machine.
 *
 * Wraps generate → answer → hint → advance against the workspace quiz API so
 * every quiz surface (Study Tools quiz, the companion's Quiz Arena) shares
 * identical behaviour: review-item bookkeeping, hint accounting (max 3,
 * counted into mastery), per-question timing, and a student-model refresh
 * after every recorded answer.
 */
import { useCallback, useRef, useState } from 'react';
import {
  answerGeneratedQuiz,
  generateWorkspaceQuiz,
  GeneratedQuizHint,
  GeneratedQuizQuestion,
  getGeneratedQuizHint,
} from '../../api/client';
import { useUserStore } from '../../store/userStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

export type QuizPhase = 'idle' | 'loading' | 'active' | 'complete';
export type QuizMode = 'mixed' | 'mcq' | 'short_answer';
export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizFeedback {
  correct: boolean;
  answer: string;
  explanation: string;
}

export interface QuizReviewItem {
  question: GeneratedQuizQuestion;
  questionNumber: number;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  evidence?: string | null;
  sourceName?: string | null;
}

export interface QuizSessionCallbacks {
  /** A quiz was generated successfully (refresh artifact history, etc.). */
  onGenerated?: () => void;
  /** An answer was recorded (drive companion emotions, etc.). */
  onAnswered?: (correct: boolean) => void;
  /** The final question was passed; ratio = score / questions. */
  onComplete?: (ratio: number) => void;
}

export function useQuizSession(callbacks?: QuizSessionCallbacks) {
  const [phase, setPhase] = useState<QuizPhase>('idle');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [reviewItems, setReviewItems] = useState<QuizReviewItem[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [visibleHints, setVisibleHints] = useState<GeneratedQuizHint[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);
  // Callbacks live in a ref so generate/submit stay referentially stable.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const question = questions[index];
  const loading = phase === 'loading';

  const generate = useCallback(
    async (conceptId: string, mode: QuizMode = 'mixed', difficulty: QuizDifficulty = 'Medium') => {
      const workspace = useWorkspaceStore.getState().workspace;
      if (!workspace?.id || !conceptId) return;
      setPhase('loading');
      setError(null);
      try {
        const data = await generateWorkspaceQuiz(workspace.id, conceptId, mode, difficulty);
        setTitle(data.title);
        setInstructions(data.instructions);
        setQuestions(data.questions);
        setIndex(0);
        setScore(0);
        setSelectedOption(null);
        setAnswerText('');
        setFeedback(null);
        setReviewItems([]);
        setVisibleHints([]);
        startedAt.current = Date.now();
        setPhase(data.questions.length ? 'active' : 'idle');
        if (!data.questions.length) {
          setError('No questions could be generated for this concept yet.');
          return;
        }
        cbRef.current?.onGenerated?.();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Could not create a quiz for this concept.');
        setPhase('idle');
      }
    },
    [],
  );

  const submit = useCallback(async (difficulty: QuizDifficulty = 'Medium') => {
    const workspace = useWorkspaceStore.getState().workspace;
    const studentId = useUserStore.getState().studentId;
    const q = questions[index];
    if (!workspace?.id || !q || feedback) return;
    if (q.question_type === 'multiple_choice' && selectedOption === null) return;
    if (q.question_type === 'short_answer' && !answerText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await answerGeneratedQuiz({
        student_id: studentId,
        workspace_id: workspace.id,
        question_id: q.id,
        selected_option: q.question_type === 'multiple_choice' ? selectedOption : null,
        answer_text: q.question_type === 'short_answer' ? answerText : undefined,
        hints_used: visibleHints.length,
        time_taken: Math.max(1, Math.round((Date.now() - (startedAt.current || Date.now())) / 1000)),
        difficulty,
      });
      if (result.is_correct) setScore((value) => value + 1);
      setFeedback({ correct: result.is_correct, answer: result.correct_answer, explanation: result.explanation });
      setReviewItems((items) => {
        const reviewItem: QuizReviewItem = {
          question: q,
          questionNumber: index + 1,
          selectedAnswer: result.selected_answer,
          correctAnswer: result.correct_answer,
          isCorrect: result.is_correct,
          explanation: result.explanation,
          evidence: result.evidence || q.evidence,
          sourceName: result.source_name || q.source_name,
        };
        return [...items.filter((item) => item.question.id !== q.id), reviewItem]
          .sort((a, b) => a.questionNumber - b.questionNumber);
      });
      await useUserStore.getState().fetchStudentData();
      cbRef.current?.onAnswered?.(result.is_correct);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not record this answer.');
    } finally {
      setSubmitting(false);
    }
  }, [questions, index, feedback, selectedOption, answerText, visibleHints.length]);

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase('complete');
      setFeedback(null);
      cbRef.current?.onComplete?.(questions.length ? score / questions.length : 0);
      return;
    }
    setIndex((value) => value + 1);
    setSelectedOption(null);
    setAnswerText('');
    setFeedback(null);
    setVisibleHints([]);
    startedAt.current = Date.now();
  }, [index, questions.length, score]);

  const requestHint = useCallback(async (): Promise<GeneratedQuizHint | null> => {
    const workspace = useWorkspaceStore.getState().workspace;
    const q = questions[index];
    if (!workspace?.id || !q || feedback || visibleHints.length >= 3) return null;
    setHintLoading(true);
    setError(null);
    try {
      const nextLevel = visibleHints.length + 1;
      const data = await getGeneratedQuizHint({
        workspace_id: workspace.id,
        question_id: q.id,
        hint_level: nextLevel,
        student_answer: q.question_type === 'short_answer' ? answerText : null,
      });
      setVisibleHints((items) => [...items, data.hint]);
      return data.hint;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load a hint for this question.');
      return null;
    } finally {
      setHintLoading(false);
    }
  }, [questions, index, feedback, visibleHints.length, answerText]);

  const reset = useCallback(() => {
    setPhase('idle');
    setTitle('');
    setInstructions('');
    setQuestions([]);
    setIndex(0);
    setScore(0);
    setReviewItems([]);
    setSelectedOption(null);
    setAnswerText('');
    setFeedback(null);
    setVisibleHints([]);
    setError(null);
    startedAt.current = null;
  }, []);

  return {
    phase,
    title,
    instructions,
    questions,
    index,
    question,
    score,
    reviewItems,
    selectedOption,
    setSelectedOption,
    answerText,
    setAnswerText,
    feedback,
    visibleHints,
    hintLoading,
    loading,
    submitting,
    error,
    generate,
    submit,
    next,
    requestHint,
    reset,
  };
}

export default useQuizSession;
