import React, { useEffect, useState } from 'react';
import { GeneratedFlashcard, getDueFlashcards, getGeneratedFlashcards, reviewGeneratedFlashcard } from '../api/client';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import { useSourcesStore } from '../store/sourcesStore';
import { useStudyStore } from '../store/studyStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';

export const FlashcardsPage: React.FC = () => {
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const workspace = useWorkspaceStore((state) => state.workspace);
  const selectedSources = useSourcesStore((state) => state.getSelectedSources());
  const studentId = useUserStore((state) => state.studentId);
  const studentData = useUserStore((state) => state.studentData);
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
      <div className="dashboard-header"><div className="header-title"><h2>Flashcards</h2><p>Review concepts from your selected sources with active recall and spaced repetition.</p></div></div>
      {selectedSources.length === 0 ? (
        <div className="card p-8 text-center text-theme-muted text-sm">Select processed sources in the Sources page first.</div>
      ) : !graphData?.nodes.length ? (
        <div className="card p-8 text-center text-theme-muted text-sm">Your selected sources do not have an available knowledge graph yet.</div>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex flex-col md:flex-row gap-4 md:items-end">
              <div className="form-group flex-1 mb-0"><label htmlFor="flashcard-topic">Concept</label><select id="flashcard-topic" value={topic} className="form-control" onChange={(event) => { setTopic(event.target.value); setSelectedNodeId(event.target.value); setCards([]); }}>{graphData.nodes.map((node) => <option key={node.id} value={node.id}>{node.display_name}</option>)}</select></div>
              <button type="button" className="btn btn-primary" onClick={generateCards} disabled={loading}>{loading ? 'Generating...' : 'Generate Flashcards'}</button>
            </div>
            {error && <p className="text-xs text-mastery-weak-text mt-3">{error}</p>}
          </div>
          {dueReviews.length > 0 && (
            <div className="card p-5">
              <div className="card-header"><h3>Due Reviews</h3><span className="badge">{dueReviews.length} cards</span></div>
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
                    <strong>{review.concept_id}</strong>
                    <p>Card rated {review.rating}. Due {review.next_review_date}.</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card p-5"><div className="card-header"><h3>Concept Review</h3><span className="badge">Source Grounded</span></div>{concept && <div className="space-y-4 text-sm"><div><p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Concept</p><p className="font-semibold">{concept.display_name}</p></div><p className="text-theme-text leading-relaxed">{concept.description || 'No description was extracted for this concept.'}</p><div><p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Current Mastery</p><p className="font-semibold">{studentData?.topics[topic]?.mastery_score || 0}%</p></div><div><p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Prerequisites</p><p>{concept.prerequisites.length ? concept.prerequisites.join(', ') : 'None'}</p></div></div>}</div>
            <div className="card p-5 xl:col-span-2">
              <div className="card-header">
                <h3>Active Recall Deck</h3>
                <span className="badge">{cards.length ? `${index + 1} / ${cards.length}` : 'Ready'}</span>
              </div>
              {!card ? (
                <p className="text-sm text-theme-muted py-12">Generate a deck, try to recall the answer, reveal it, then rate your recall quality.</p>
              ) : (
                <div className="space-y-4">
                  {card.source_name && <span className="badge">Grounded in {card.source_name}</span>}
                  <button type="button" onClick={() => setFlipped((value) => !value)} className="w-full min-h-56 border border-dashed border-theme-border rounded bg-theme-bg p-8 text-center text-base font-medium text-theme-text">{flipped ? card.back : card.front}</button>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn btn-secondary" onClick={() => setFlipped((value) => !value)}>{flipped ? 'Show Prompt' : 'Reveal Answer'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setIndex((value) => (value + 1) % cards.length); setFlipped(false); }}>Skip</button>
                  </div>
                  <div className="recommendation-box">
                    <strong>Rate your recall</strong>
                    <p>Again means review today, Hard means tomorrow, Good means in 3 days, Easy means about a week later.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(['again', 'hard', 'good', 'easy'] as const).map((value) => (
                        <button key={value} type="button" className={`btn ${value === 'easy' || value === 'good' ? 'btn-primary' : 'btn-secondary'}`} disabled={!flipped || rating !== null} onClick={() => rateCard(value)}>
                          {rating === value ? 'Saving...' : value[0].toUpperCase() + value.slice(1)}
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
