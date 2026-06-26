import React, { useEffect, useState } from 'react';
import {
  answerGeneratedQuiz,
  generateWorkspaceQuiz,
  GeneratedFlashcard,
  GeneratedQuizQuestion,
  getGeneratedFlashcards,
} from '../api/client';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useSourcesStore } from '../store/sourcesStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';

export const QuizPage: React.FC = () => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((s) => s.getSelectedSources());
  const workspace = useWorkspaceStore((s) => s.workspace);
  const studentId = useUserStore((state) => state.studentId);
  const studentData = useUserStore((state) => state.studentData);
  const fetchStudentData = useUserStore((state) => state.fetchStudentData);

  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; explanation: string } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flashcards, setFlashcards] = useState<GeneratedFlashcard[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (graphData?.nodes.length) {
      const nextTopic = selectedNodeId || graphData.nodes[0].id;
      setTopic(nextTopic);
    }
  }, [graphData, selectedNodeId]);

  const currentQuestion = questions[questionIndex];
  const topicDetails = studentData && topic ? studentData.topics[topic] : null;

  const generateQuiz = async () => {
    if (!workspace?.id || !topic) return;
    setLoadingQuiz(true);
    setError(null);
    try {
      const data = await generateWorkspaceQuiz(workspace.id, topic);
      setQuestions(data.questions);
      setQuestionIndex(0);
      setSelectedOption(null);
      setFeedback(null);
      setHintsUsed(0);
      setStartedAt(Date.now());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not generate a quiz from this concept.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const submitAnswer = async () => {
    if (!workspace?.id || !currentQuestion || selectedOption === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTaken = Math.max(1, Math.round((Date.now() - (startedAt || Date.now())) / 1000));
      const result = await answerGeneratedQuiz({
        student_id: studentId,
        workspace_id: workspace.id,
        question_id: currentQuestion.id,
        selected_option: selectedOption,
        hints_used: hintsUsed,
        time_taken: timeTaken,
      });
      setFeedback({ correct: result.is_correct, answer: result.correct_answer, explanation: result.explanation });
      await fetchStudentData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not record this answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    if (questionIndex + 1 >= questions.length) {
      setQuestions([]);
      setFeedback(null);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedOption(null);
    setFeedback(null);
    setHintsUsed(0);
    setStartedAt(Date.now());
  };

  const generateFlashcards = async () => {
    if (!workspace?.id || !topic) return;
    setLoadingCards(true);
    setError(null);
    try {
      const data = await getGeneratedFlashcards(workspace.id, topic);
      setFlashcards(data.cards);
      setFlashcardIndex(0);
      setFlashcardFlipped(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not generate flashcards for this concept.');
    } finally {
      setLoadingCards(false);
    }
  };

  const flashcard = flashcards[flashcardIndex];

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Quiz and Revision</h2>
          <p>Generate practice and flashcards from concepts in your selected knowledge sources</p>
        </div>
      </div>

      {selectedSources.length === 0 ? (
        <div className="card p-8 text-center text-theme-muted text-sm">Select processed sources in the Sources page first.</div>
      ) : !graphData?.nodes.length ? (
        <div className="card p-8 text-center text-theme-muted text-sm">Your selected sources do not have an available knowledge graph yet.</div>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex flex-col md:flex-row gap-4 md:items-end">
              <div className="form-group flex-1 mb-0">
                <label htmlFor="generated-topic">Concept</label>
                <select
                  id="generated-topic"
                  value={topic}
                  onChange={(event) => {
                    setTopic(event.target.value);
                    setSelectedNodeId(event.target.value);
                    setQuestions([]);
                    setFlashcards([]);
                    setFeedback(null);
                  }}
                  className="form-control"
                >
                  {graphData.nodes.map((node) => <option key={node.id} value={node.id}>{node.display_name}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={generateQuiz} disabled={loadingQuiz}>
                {loadingQuiz ? 'Generating...' : 'Generate 3 Questions'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={generateFlashcards} disabled={loadingCards}>
                {loadingCards ? 'Generating...' : 'Generate Flashcards'}
              </button>
            </div>
            {topicDetails && <p className="text-xs text-theme-muted mt-4">Current mastery: {topicDetails.mastery_score}%</p>}
            {error && <p className="text-xs text-mastery-weak-text mt-3">{error}</p>}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="card-header"><h3>Practice Quiz</h3><span className="badge">Source Grounded</span></div>
              {!currentQuestion ? (
                <p className="text-sm text-theme-muted py-8">Choose a concept and generate a quiz to begin practice.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-theme-muted">Question {questionIndex + 1} of {questions.length}</p>
                  <p className="font-semibold text-theme-text">{currentQuestion.prompt}</p>
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        type="button"
                        key={`${currentQuestion.id}-${index}`}
                        disabled={Boolean(feedback)}
                        onClick={() => setSelectedOption(index)}
                        className={`w-full text-left border rounded p-3 text-sm transition-colors ${selectedOption === index ? 'border-theme-primary bg-theme-bg' : 'border-theme-border hover:bg-theme-bg'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {!feedback ? (
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="form-group mb-0 w-32">
                        <label htmlFor="hints-used">Hints</label>
                        <input id="hints-used" className="form-control" type="number" min="0" max="5" value={hintsUsed} onChange={(event) => setHintsUsed(Number(event.target.value))} />
                      </div>
                      <button type="button" className="btn btn-primary" disabled={selectedOption === null || submitting} onClick={submitAnswer}>
                        {submitting ? 'Checking...' : 'Submit Answer'}
                      </button>
                    </div>
                  ) : (
                    <div className={`recommendation-box ${feedback.correct ? '' : 'revision-needed'}`}>
                      <strong>{feedback.correct ? 'Correct' : 'Not quite'}</strong>
                      <p>{feedback.explanation}</p>
                      {!feedback.correct && <p>Correct answer: {feedback.answer}</p>}
                      <button type="button" className="btn btn-secondary mt-3" onClick={nextQuestion}>
                        {questionIndex + 1 === questions.length ? 'Finish Quiz' : 'Next Question'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="card-header"><h3>Generated Flashcards</h3><span className="badge">Active Recall</span></div>
              {!flashcard ? (
                <p className="text-sm text-theme-muted py-8">Generate flashcards for the selected concept to start revising.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-theme-muted">Card {flashcardIndex + 1} of {flashcards.length}</p>
                  <button type="button" onClick={() => setFlashcardFlipped((value) => !value)} className="w-full min-h-40 border border-dashed border-theme-border rounded bg-theme-bg p-6 text-center text-sm text-theme-text">
                    {flashcardFlipped ? flashcard.back : flashcard.front}
                  </button>
                  <div className="flex gap-3">
                    <button type="button" className="btn btn-secondary" onClick={() => setFlashcardFlipped((value) => !value)}>Flip Card</button>
                    <button type="button" className="btn btn-primary" onClick={() => { setFlashcardIndex((index) => (index + 1) % flashcards.length); setFlashcardFlipped(false); }}>Next Card</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
