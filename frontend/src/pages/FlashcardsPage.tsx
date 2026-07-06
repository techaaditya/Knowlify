import React, { useEffect, useState } from 'react';
import { GeneratedFlashcard, getDueFlashcards, getGeneratedFlashcards, reviewGeneratedFlashcard } from '../api/client';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import { useSourcesStore } from '../store/sourcesStore';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';

const ratingMeta = {
  again: { label: 'Again', detail: 'Review today', color: 'var(--weak-hue)', bg: 'var(--weak-bg)', border: 'var(--weak-border)' },
  hard: { label: 'Hard', detail: 'Review tomorrow', color: '#8a6232', bg: '#fff8e8', border: '#e6cf9a' },
  good: { label: 'Good', detail: 'Review in 3 days', color: 'var(--medium-hue)', bg: 'var(--medium-bg)', border: 'var(--medium-border)' },
  easy: { label: 'Easy', detail: 'Review next week', color: 'var(--strong-hue)', bg: 'var(--strong-bg)', border: 'var(--strong-border)' },
} as const;

const difficultyLabel = (difficulty?: string) => {
  if (!difficulty) return 'Adaptive';
  return difficulty[0].toUpperCase() + difficulty.slice(1);
};

interface FlashcardsPageProps {
  embedded?: boolean;
}

export const FlashcardsPage: React.FC<FlashcardsPageProps> = ({ embedded = false }) => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const selectedSources = useSourcesStore((state) => state.getSelectedSources());
  const studentId = useUserStore((state) => state.studentId);
  const studentData = useUserStore((state) => state.studentData);
  const fetchStudentData = useUserStore((state) => state.fetchStudentData);
  const [topic, setTopic] = useState('');
  const [cards, setCards] = useState<GeneratedFlashcard[]>([]);
  const [dueReviews, setDueReviews] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (graphData?.nodes.length) setTopic(selectedNodeId || graphData.nodes[0].id);
  }, [graphData, selectedNodeId]);

  const concept = graphData?.nodes.find((node) => node.id === topic);
  const card = cards[index];
  const mastery = studentData?.topics[topic]?.mastery_score || 0;
  const progress = cards.length ? ((index + 1) / cards.length) * 100 : 0;

  useEffect(() => {
    if (!workspace?.id) return;
    getDueFlashcards(studentId, workspace.id)
      .then((data) => setDueReviews(data.due_reviews as any[]))
      .catch(() => setDueReviews([]));
  }, [studentId, workspace?.id]);

  const generateCards = async () => {
    if (!workspace?.id || !topic) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getGeneratedFlashcards(workspace.id, topic, 5);
      setCards(data.cards);
      setIndex(0);
      setFlipped(false);
      setRating(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not generate flashcards for this concept.');
    } finally {
      setLoading(false);
    }
  };

  const rateCard = async (value: 'again' | 'hard' | 'good' | 'easy') => {
    if (!workspace?.id || !card) return;
    setRating(value);
    try {
      await reviewGeneratedFlashcard({
        student_id: studentId,
        workspace_id: workspace.id,
        concept_id: topic,
        card_id: card.id,
        rating: value,
      });
      await fetchStudentData();
      const due = await getDueFlashcards(studentId, workspace.id);
      setDueReviews(due.due_reviews as any[]);
      setIndex((current) => (current + 1) % cards.length);
      setFlipped(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save flashcard review.');
    } finally {
      setRating(null);
    }
  };

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />
      {!embedded && (
        <div className="dashboard-header">
          <div className="header-title">
            <h2>Flashcards</h2>
            <p>Review concepts from your selected sources with active recall and spaced repetition.</p>
          </div>
          <div className="metric-card compact">
            <span className="metric-label">Due Today</span>
            <strong className="metric-value">{dueReviews.length}</strong>
          </div>
        </div>
      )}
      {selectedSources.length === 0 ? (
        <div className="card p-8 text-center text-theme-muted text-sm">Select processed sources in the Sources page first.</div>
      ) : !graphData?.nodes.length ? (
        <div className="card p-8 text-center text-theme-muted text-sm">Your selected sources do not have an available knowledge graph yet.</div>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
              <div className="form-group flex-1 mb-0">
                <label htmlFor="flashcard-topic">Concept</label>
                <select
                  id="flashcard-topic"
                  value={topic}
                  className="form-control"
                  onChange={(event) => {
                    setTopic(event.target.value);
                    setSelectedNodeId(event.target.value);
                    setCards([]);
                    setIndex(0);
                    setFlipped(false);
                  }}
                >
                  {graphData.nodes.map((node) => <option key={node.id} value={node.id}>{node.display_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button type="button" className="btn btn-primary" onClick={generateCards} disabled={loading}>
                  {loading ? 'Building deck...' : cards.length ? 'Regenerate Deck' : 'Generate Flashcards'}
                </button>
                {cards.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIndex(0);
                      setFlipped(false);
                    }}
                  >
                    Restart Deck
                  </button>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-mastery-weak-text mt-3">{error}</p>}
          </div>
          {dueReviews.length > 0 && (
            <div className="card p-5">
              <div className="card-header">
                <h3>Due Reviews</h3>
                <span className="badge">{dueReviews.length} cards</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dueReviews.slice(0, 4).map((review) => (
                  <button
                    type="button"
                    key={`${review.card_id}-${review.next_review_date}`}
                    className="recommendation-box text-left"
                    onClick={() => {
                      setTopic(review.concept_id);
                      setSelectedNodeId(review.concept_id);
                      setCards([]);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong>{review.concept_id}</strong>
                      <span className="badge">{review.rating}</span>
                    </div>
                    <p>Due {review.next_review_date}. Click to open this concept.</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card p-5">
              <div className="card-header">
                <h3>Concept Snapshot</h3>
                <span className="badge">Source Grounded</span>
              </div>
              {concept && (
                <div className="space-y-5 text-sm">
                  <div>
                    <p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Concept</p>
                    <p className="font-semibold text-lg text-theme-text">{concept.display_name}</p>
                  </div>
                  <p className="text-theme-text leading-relaxed">{concept.description || 'No description was extracted for this concept.'}</p>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-theme-muted uppercase tracking-wider">Mastery</span>
                      <strong>{mastery}%</strong>
                    </div>
                    <div className="h-3 rounded-full bg-theme-bg overflow-hidden border border-theme-border">
                      <div className="h-full bg-theme-primary" style={{ width: `${Math.min(100, Math.max(0, mastery))}%` }} />
                    </div>
                  </div>
                  <div className="p-4 rounded border border-theme-border bg-theme-bg">
                    <p className="text-theme-muted text-xs uppercase tracking-wider mb-2">Prerequisites</p>
                    <p className="text-theme-text">{concept.prerequisites.length ? concept.prerequisites.join(', ') : 'None'}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="card p-5 xl:col-span-2">
              <div className="card-header">
                <h3>Active Recall Deck</h3>
                <span className="badge">{cards.length ? `${index + 1} / ${cards.length}` : 'Ready'}</span>
              </div>
              {!card ? (
                <div className="text-center py-16 px-6 border border-dashed border-theme-border rounded bg-theme-bg">
                  <p className="text-xl font-bold text-theme-text mb-2">No deck generated yet</p>
                  <p className="text-sm text-theme-muted max-w-lg mx-auto">Choose a concept and generate flashcards. Try to recall the answer first, reveal it, then rate how well you remembered it.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-theme-muted mb-2">
                      <span>{flipped ? 'Answer side' : 'Prompt side'}</span>
                      <span>{Math.round(progress)}% through deck</span>
                    </div>
                    <div className="h-2 bg-theme-bg rounded overflow-hidden">
                      <div className="h-full bg-theme-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlipped((value) => !value)}
                    className="w-full text-left rounded-lg border bg-white shadow-sm transition-transform hover:-translate-y-0.5"
                    style={{
                      borderColor: flipped ? 'var(--swatch-4)' : 'var(--border-soft)',
                      minHeight: 300,
                      background: flipped
                        ? 'linear-gradient(135deg, #fffdf8 0%, #f7efe2 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f6f4ef 100%)',
                    }}
                  >
                    <div className="h-full min-h-72 p-8 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-3">
                        <span className="badge">{difficultyLabel(card.difficulty)}</span>
                        {card.source_name && <span className="badge">Grounded in {card.source_name}</span>}
                      </div>
                      <p className="text-2xl md:text-3xl font-bold leading-snug text-theme-text text-center my-10">
                        {flipped ? card.back : card.front}
                      </p>
                      <p className="text-xs text-theme-muted text-center">Click card to {flipped ? 'return to prompt' : 'reveal answer'}</p>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn btn-secondary" onClick={() => setFlipped((value) => !value)}>{flipped ? 'Show Prompt' : 'Reveal Answer'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setIndex((value) => (value + 1) % cards.length); setFlipped(false); }}>Skip</button>
                  </div>
                  <div className="rounded-lg border border-theme-border bg-theme-bg p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <strong className="text-theme-text">Rate your recall</strong>
                        <p className="text-sm text-theme-muted">Your rating schedules the next review and helps the student model track recall strength.</p>
                      </div>
                      <span className="badge">Spaced Repetition</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {(['again', 'hard', 'good', 'easy'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!flipped || rating !== null}
                          onClick={() => rateCard(value)}
                          className="text-left rounded border p-3 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                          style={{
                            color: ratingMeta[value].color,
                            background: ratingMeta[value].bg,
                            borderColor: ratingMeta[value].border,
                          }}
                        >
                          <strong className="block text-sm">{rating === value ? 'Saving...' : ratingMeta[value].label}</strong>
                          <span className="text-xs">{ratingMeta[value].detail}</span>
                        </button>
                      ))}
                    </div>
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
