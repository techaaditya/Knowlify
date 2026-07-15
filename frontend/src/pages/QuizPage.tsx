import React, { useEffect, useRef, useState } from 'react';
import {
  answerGeneratedQuiz,
  generateWorkspaceQuiz,
  GeneratedQuizHint,
  GeneratedQuizQuestion,
  getGeneratedQuizHint,
} from '../api/client';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import { useSourcesStore } from '../store/sourcesStore';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useAssistantStore } from '../store/assistantStore';

interface QuizPageProps {
  embedded?: boolean;
  onGenerated?: () => void;
  autoGenerateKey?: number;
  autoConceptId?: string | null;
  onAutoGenerateConsumed?: () => void;
}

interface QuizReviewItem {
  question: GeneratedQuizQuestion;
  questionNumber: number;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  evidence?: string | null;
  sourceName?: string | null;
}

export const QuizPage: React.FC<QuizPageProps> = ({
  embedded = false,
  onGenerated,
  autoGenerateKey,
  autoConceptId,
  onAutoGenerateConsumed,
}) => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((state) => state.getSelectedSources());
  const workspace = useWorkspaceStore((state) => state.workspace);
  const studentId = useUserStore((state) => state.studentId);
  const studentData = useUserStore((state) => state.studentData);
  const fetchStudentData = useUserStore((state) => state.fetchStudentData);
  const requestAssistantHelp = useAssistantStore((state) => state.requestHelp);
  const addAssistantMessage = useAssistantStore((state) => state.addMessage);
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [questionMode, setQuestionMode] = useState<'mixed' | 'mcq' | 'short_answer'>('mixed');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; explanation: string } | null>(null);
  const [reviewItems, setReviewItems] = useState<QuizReviewItem[]>([]);
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [visibleHints, setVisibleHints] = useState<GeneratedQuizHint[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consumedAutoGenerateKey = useRef<number | null>(null);

  useEffect(() => {
    if (graphData?.nodes.length) setTopic(selectedNodeId || graphData.nodes[0].id);
  }, [graphData, selectedNodeId]);

  const question = questions[index];
  const mastery = studentData?.topics[topic]?.mastery_score || 0;

  const createQuiz = async () => {
    if (!workspace?.id || !topic) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateWorkspaceQuiz(workspace.id, topic, questionMode, difficulty);
      setTitle(data.title);
      setInstructions(data.instructions);
      setQuestions(data.questions);
      setIndex(0);
      setScore(0);
      setComplete(false);
      setSelectedOption(null);
      setAnswerText('');
      setFeedback(null);
      setReviewItems([]);
      setHintsUsed(0);
      setVisibleHints([]);
      setStartedAt(Date.now());
      onGenerated?.();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create a quiz for this concept.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoGenerateKey || consumedAutoGenerateKey.current === autoGenerateKey) return;
    if (!workspace?.id || !topic || loading) return;
    if (autoConceptId && autoConceptId !== topic) {
      setTopic(autoConceptId);
      setSelectedNodeId(autoConceptId);
      return;
    }
    consumedAutoGenerateKey.current = autoGenerateKey;
    onAutoGenerateConsumed?.();
    createQuiz();
  }, [autoGenerateKey, autoConceptId, topic, workspace?.id, loading]);

  const submitAnswer = async () => {
    if (!workspace?.id || !question) return;
    if (question.question_type === 'multiple_choice' && selectedOption === null) return;
    if (question.question_type === 'short_answer' && !answerText.trim()) return;
    setSubmitting(true);
    try {
      const result = await answerGeneratedQuiz({
        student_id: studentId,
        workspace_id: workspace.id,
        question_id: question.id,
        selected_option: question.question_type === 'multiple_choice' ? selectedOption : null,
        answer_text: question.question_type === 'short_answer' ? answerText : undefined,
        hints_used: visibleHints.length || hintsUsed,
        time_taken: Math.max(1, Math.round((Date.now() - (startedAt || Date.now())) / 1000)),
        difficulty,
      });
      if (result.is_correct) setScore((value) => value + 1);
      setFeedback({ correct: result.is_correct, answer: result.correct_answer, explanation: result.explanation });
      setReviewItems((items) => {
        const reviewItem: QuizReviewItem = {
          question,
          questionNumber: index + 1,
          selectedAnswer: result.selected_answer,
          correctAnswer: result.correct_answer,
          isCorrect: result.is_correct,
          explanation: result.explanation,
          evidence: result.evidence || question.evidence,
          sourceName: result.source_name || question.source_name,
        };
        return [...items.filter((item) => item.question.id !== question.id), reviewItem]
          .sort((a, b) => a.questionNumber - b.questionNumber);
      });
      await fetchStudentData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not record this answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueQuiz = () => {
    if (index + 1 === questions.length) { setComplete(true); setFeedback(null); return; }
    setIndex((value) => value + 1); setSelectedOption(null); setAnswerText(''); setFeedback(null); setHintsUsed(0); setVisibleHints([]); setStartedAt(Date.now());
  };

  const currentReviewItem = question
    ? reviewItems.find((item) => item.question.id === question.id)
    : null;

  const getConceptName = (conceptId: string) => (
    graphData?.nodes.find((node) => node.id === conceptId)?.display_name || conceptId
  );

  const openLearnMore = (item: QuizReviewItem) => {
    const conceptName = getConceptName(item.question.concept_id);
    const sourceLine = item.sourceName ? `\nSource: ${item.sourceName}` : '';
    const evidenceLine = item.evidence ? `\nSource evidence: ${item.evidence}` : '';
    const prompt = [
      `Explain this quiz question about ${conceptName}.`,
      `Question: ${item.question.prompt}`,
      `My answer: ${item.selectedAnswer || 'No answer recorded'}`,
      `Correct answer: ${item.correctAnswer}`,
      `Result: ${item.isCorrect ? 'I got it right' : 'I got it wrong'}.`,
      `Please explain why the correct answer is correct, why my answer ${item.isCorrect ? 'works' : 'does not work'}, and what I should remember next time.${sourceLine}${evidenceLine}`,
    ].join('\n');

    if (!workspace?.id) return;
    requestAssistantHelp({
      workspaceId: workspace.id,
      conceptId: item.question.concept_id,
      title: `Explain question ${item.questionNumber}`,
      prompt,
    });
  };

  const requestHint = async () => {
    if (!workspace?.id || !question || feedback || visibleHints.length >= 3) return;
    setHintLoading(true);
    setError(null);
    try {
      const nextLevel = visibleHints.length + 1;
      const data = await getGeneratedQuizHint({
        workspace_id: workspace.id,
        question_id: question.id,
        hint_level: nextLevel,
        student_answer: question.question_type === 'short_answer' ? answerText : null,
      });
      setVisibleHints((items) => [...items, data.hint]);
      setHintsUsed(data.hints_used);
      addAssistantMessage({
        workspaceId: workspace.id,
        kind: 'hint',
        title: data.hint.title,
        content: `${data.hint.text}\n\nThis is hint ${nextLevel} of 3. Your quiz remains open behind this assistant.`,
      });
      useAssistantStore.getState().open();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load a hint for this question.');
    } finally {
      setHintLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />
      {!embedded && (
        <div className="dashboard-header">
          <div className="header-title">
            <h2>Concept Quiz</h2>
            <p>Assess understanding of a selected concept, its meaning, prerequisites, and learning-path relationships.</p>
          </div>
        </div>
      )}
      {selectedSources.length === 0 ? <div className="card p-8 text-center text-theme-muted text-sm">Select processed sources in the Sources page first.</div> : !graphData?.nodes.length ? <div className="card p-8 text-center text-theme-muted text-sm">Your selected sources do not have an available knowledge graph yet.</div> : <>
        <div className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:items-end">
            <div className="form-group mb-0 md:col-span-2">
              <label htmlFor="quiz-topic">Concept</label>
              <select id="quiz-topic" value={topic} className="form-control" onChange={(event) => { setTopic(event.target.value); setSelectedNodeId(event.target.value); setQuestions([]); setComplete(false); }}>
                {graphData.nodes.map((node) => <option key={node.id} value={node.id}>{node.display_name}</option>)}
              </select>
            </div>
            <div className="form-group mb-0">
              <label htmlFor="quiz-mode">Question Type</label>
              <select id="quiz-mode" className="form-control" value={questionMode} onChange={(event) => { setQuestionMode(event.target.value as typeof questionMode); setQuestions([]); }}>
                <option value="mixed">Mixed</option>
                <option value="mcq">MCQ</option>
                <option value="short_answer">Short Answer</option>
              </select>
            </div>
            <div className="form-group mb-0">
              <label htmlFor="quiz-difficulty">Difficulty</label>
              <select id="quiz-difficulty" className="form-control" value={difficulty} onChange={(event) => { setDifficulty(event.target.value as typeof difficulty); setQuestions([]); }}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center justify-between mt-6">
            <p className="text-sm font-medium text-theme-secondary leading-relaxed">Current mastery: <strong className="text-theme-text">{mastery}%</strong>. Hard questions have more impact on mastery than easy questions.</p>
            <button type="button" className="btn btn-primary" onClick={createQuiz} disabled={loading}>{loading ? 'Creating Quiz...' : 'Create Concept Quiz'}</button>
          </div>
          {error && <p className="text-xs text-mastery-weak-text mt-3">{error}</p>}
        </div>
        <div className="card p-5">
          {!questions.length ? (
            <p className="text-sm text-theme-muted py-12">Choose a concept and create a quiz. The number and type of questions adapt to the information available in its learning graph.</p>
          ) : complete ? (
            <div className="py-6 space-y-5">
              <div className="text-center space-y-3">
                <h3 className="text-xl font-bold">Quiz Complete</h3>
                <p className="text-theme-muted">You answered {score} of {questions.length} questions correctly.</p>
                <button type="button" className="btn btn-primary" onClick={createQuiz}>Create Another Quiz</button>
              </div>

              <div className="border-t border-theme-border pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-theme-text">Question Review</h3>
                    <p className="text-xs text-theme-muted">Review every answer and open the tutor for a source-grounded explanation.</p>
                  </div>
                  <span className="badge">{reviewItems.length} answered</span>
                </div>

                <div className="space-y-3">
                  {reviewItems.map((item) => (
                    <div
                      key={item.question.id}
                      className={`recommendation-box ${item.isCorrect ? '' : 'revision-needed'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <span className="badge">
                            Question {item.questionNumber} - {item.isCorrect ? 'Correct' : 'Needs Review'}
                          </span>
                          <p className="font-semibold text-theme-text">{item.question.prompt}</p>
                          <p className="text-sm text-theme-muted">Your answer: {item.selectedAnswer || 'No answer recorded'}</p>
                          <p className="text-sm text-theme-muted">Correct answer: {item.correctAnswer}</p>
                          <p className="text-sm">{item.explanation}</p>
                          {item.sourceName && <span className="badge">Grounded in {item.sourceName}</span>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openLearnMore(item)}
                        >
                          Learn More
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="card-header">
                <div>
                  <h3>{title}</h3>
                  <p className="text-xs text-theme-muted mt-1">{instructions}</p>
                </div>
                <span className="badge">Question {index + 1} of {questions.length} - {question.difficulty}</span>
              </div>
              <div className="h-2 bg-theme-bg rounded overflow-hidden">
                <div className="h-full bg-theme-primary" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
              </div>
              {question.source_name && <span className="badge">Grounded in {question.source_name}</span>}
              <p className="font-semibold text-theme-text text-base">{question.prompt}</p>
              {question.question_type === 'multiple_choice' ? (
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <button type="button" key={`${question.id}-${optionIndex}`} disabled={Boolean(feedback)} onClick={() => setSelectedOption(optionIndex)} className={`w-full text-left border rounded p-3 text-sm transition-colors ${selectedOption === optionIndex ? 'border-theme-primary bg-theme-bg' : 'border-theme-border hover:bg-theme-bg'}`}>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  className="form-control min-h-32"
                  value={answerText}
                  disabled={Boolean(feedback)}
                  onChange={(event) => setAnswerText(event.target.value)}
                  placeholder="Write a short explanation using the source excerpt."
                />
              )}
              {!feedback ? (
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={hintLoading || visibleHints.length >= 3}
                      onClick={requestHint}
                    >
                      {hintLoading ? 'Loading Hint...' : visibleHints.length >= 3 ? 'All Hints Shown' : `Get Hint ${visibleHints.length + 1}`}
                    </button>
                    <p className="text-xs text-theme-muted">{visibleHints.length} of 3 hints used. More hints reduce mastery gain slightly.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={(question.question_type === 'multiple_choice' ? selectedOption === null : !answerText.trim()) || submitting}
                    onClick={submitAnswer}
                  >
                    {submitting ? 'Checking...' : 'Submit Answer'}
                  </button>
                </div>
              ) : (
                <div className={`recommendation-box ${feedback.correct ? '' : 'revision-needed'}`}>
                  <strong>{feedback.correct ? 'Correct' : 'Review this idea'}</strong>
                  <p>{feedback.explanation}</p>
                  {!feedback.correct && <p>Expected answer: {feedback.answer}</p>}
                  <div className="flex flex-wrap gap-3 mt-3">
                    {currentReviewItem && (
                      <button type="button" className="btn btn-secondary" onClick={() => openLearnMore(currentReviewItem)}>
                        Learn More
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary" onClick={continueQuiz}>
                      {index + 1 === questions.length ? 'View Results' : 'Continue Quiz'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </>}
    </div>
  );
};
