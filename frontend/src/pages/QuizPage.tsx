import React, { useEffect, useState } from 'react';
import { answerGeneratedQuiz, generateWorkspaceQuiz, GeneratedQuizQuestion } from '../api/client';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import { useSourcesStore } from '../store/sourcesStore';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';

interface QuizPageProps {
  embedded?: boolean;
}

export const QuizPage: React.FC<QuizPageProps> = ({ embedded = false }) => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((state) => state.getSelectedSources());
  const workspace = useWorkspaceStore((state) => state.workspace);
  const studentId = useUserStore((state) => state.studentId);
  const studentData = useUserStore((state) => state.studentData);
  const fetchStudentData = useUserStore((state) => state.fetchStudentData);
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
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setHintsUsed(0);
      setStartedAt(Date.now());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create a quiz for this concept.');
    } finally {
      setLoading(false);
    }
  };

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
        hints_used: hintsUsed,
        time_taken: Math.max(1, Math.round((Date.now() - (startedAt || Date.now())) / 1000)),
        difficulty,
      });
      if (result.is_correct) setScore((value) => value + 1);
      setFeedback({ correct: result.is_correct, answer: result.correct_answer, explanation: result.explanation });
      await fetchStudentData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not record this answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueQuiz = () => {
    if (index + 1 === questions.length) { setComplete(true); setFeedback(null); return; }
    setIndex((value) => value + 1); setSelectedOption(null); setAnswerText(''); setFeedback(null); setHintsUsed(0); setStartedAt(Date.now());
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
          <div className="flex flex-wrap gap-3 items-center justify-between mt-4">
            <p className="text-xs text-theme-muted">Current mastery: {mastery}%. Hard questions have more impact on mastery than easy questions.</p>
            <button type="button" className="btn btn-primary" onClick={createQuiz} disabled={loading}>{loading ? 'Creating Quiz...' : 'Create Concept Quiz'}</button>
          </div>
          {error && <p className="text-xs text-mastery-weak-text mt-3">{error}</p>}
        </div>
        <div className="card p-5">
          {!questions.length ? (
            <p className="text-sm text-theme-muted py-12">Choose a concept and create a quiz. The number and type of questions adapt to the information available in its learning graph.</p>
          ) : complete ? (
            <div className="text-center py-10 space-y-4">
              <h3 className="text-xl font-bold">Quiz Complete</h3>
              <p className="text-theme-muted">You answered {score} of {questions.length} questions correctly.</p>
              <button type="button" className="btn btn-primary" onClick={createQuiz}>Create Another Quiz</button>
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
                  <div className="form-group mb-0 w-32">
                    <label htmlFor="quiz-hints">Hints Used</label>
                    <input id="quiz-hints" className="form-control" type="number" min="0" max="5" value={hintsUsed} onChange={(event) => setHintsUsed(Number(event.target.value))} />
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
                  <button type="button" className="btn btn-secondary mt-3" onClick={continueQuiz}>{index + 1 === questions.length ? 'View Results' : 'Continue Quiz'}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </>}
    </div>
  );
};
