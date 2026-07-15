import React, { useEffect, useState } from 'react';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import { ConceptPicker } from '../components/shared/ConceptPicker';
import { useAutoGenerate } from '../components/shared/useAutoGenerate';
import { useQuizSession, QuizReviewItem, QuizDifficulty, QuizMode } from '../components/shared/useQuizSession';
import { useCompanionChat } from '../companion/useCompanionChat';
import { useSourcesStore } from '../store/sourcesStore';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';

interface QuizPageProps {
  embedded?: boolean;
  onGenerated?: () => void;
  autoGenerateKey?: number;
  autoConceptId?: string | null;
  onAutoGenerateConsumed?: () => void;
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
  const studentData = useUserStore((state) => state.studentData);
  const chat = useCompanionChat();

  const [topic, setTopic] = useState('');
  const [questionMode, setQuestionMode] = useState<QuizMode>('mixed');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');

  const session = useQuizSession({ onGenerated });
  const {
    phase, title, instructions, questions, index, question, score, reviewItems,
    selectedOption, setSelectedOption, answerText, setAnswerText, feedback,
    visibleHints, hintLoading, loading, submitting, error,
  } = session;

  useEffect(() => {
    if (graphData?.nodes.length) setTopic(selectedNodeId || graphData.nodes[0].id);
  }, [graphData, selectedNodeId]);

  const mastery = studentData?.topics[topic]?.mastery_score || 0;
  const complete = phase === 'complete';

  const createQuiz = () => session.generate(topic, questionMode, difficulty);

  useAutoGenerate({
    autoGenerateKey,
    autoConceptId,
    topic,
    setTopic: (conceptId) => {
      setTopic(conceptId);
      setSelectedNodeId(conceptId);
    },
    ready: Boolean(workspace?.id && topic && !loading),
    onConsumed: onAutoGenerateConsumed,
    run: createQuiz,
  });

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
    chat.explain(prompt, { conceptId: item.question.concept_id });
  };

  const requestHint = async () => {
    const hint = await session.requestHint();
    if (!hint) return;
    chat.postNote(
      `**${hint.title}**\n\n${hint.text}\n\nThis is hint ${hint.level} of 3. Your quiz stays open behind me.`,
      { open: true },
    );
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
      {selectedSources.length === 0 ? <div className="card p-8 text-center text-theme-muted text-sm">Select processed sources in the Library first.</div> : !graphData?.nodes.length ? <div className="card p-8 text-center text-theme-muted text-sm">Your selected sources do not have an available knowledge graph yet.</div> : <>
        <div className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:items-end">
            <div className="form-group mb-0 md:col-span-2">
              <label htmlFor="quiz-topic">Concept</label>
              <ConceptPicker
                id="quiz-topic"
                value={topic}
                className="form-control"
                onChange={(conceptId) => {
                  setTopic(conceptId);
                  session.reset();
                }}
              />
            </div>
            <div className="form-group mb-0">
              <label htmlFor="quiz-mode">Question Type</label>
              <select id="quiz-mode" className="form-control" value={questionMode} onChange={(event) => { setQuestionMode(event.target.value as QuizMode); session.reset(); }}>
                <option value="mixed">Mixed</option>
                <option value="mcq">MCQ</option>
                <option value="short_answer">Short Answer</option>
              </select>
            </div>
            <div className="form-group mb-0">
              <label htmlFor="quiz-difficulty">Difficulty</label>
              <select id="quiz-difficulty" className="form-control" value={difficulty} onChange={(event) => { setDifficulty(event.target.value as QuizDifficulty); session.reset(); }}>
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
                    <p className="text-xs text-theme-muted">Review every answer and open the mentor for a source-grounded explanation.</p>
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
                <span className="badge">Question {index + 1} of {questions.length} - {question?.difficulty}</span>
              </div>
              <div className="h-2 bg-theme-bg rounded overflow-hidden">
                <div className="h-full bg-theme-primary" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
              </div>
              {question?.source_name && <span className="badge">Grounded in {question.source_name}</span>}
              <p className="font-semibold text-theme-text text-base">{question?.prompt}</p>
              {question?.question_type === 'multiple_choice' ? (
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
                    disabled={(question?.question_type === 'multiple_choice' ? selectedOption === null : !answerText.trim()) || submitting}
                    onClick={() => session.submit(difficulty)}
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
                    <button type="button" className="btn btn-secondary" onClick={session.next}>
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
