import React, { useEffect, useState } from 'react';
import { GeneratedFlashcard, getGeneratedFlashcards } from '../api/client';
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
  const studentData = useUserStore((state) => state.studentData);
  const [topic, setTopic] = useState('');
  const [cards, setCards] = useState<GeneratedFlashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (graphData?.nodes.length) setTopic(selectedNodeId || graphData.nodes[0].id);
  }, [graphData, selectedNodeId]);

  const concept = graphData?.nodes.find((node) => node.id === topic);
  const card = cards[index];

  const generateCards = async () => {
    if (!workspace?.id || !topic) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getGeneratedFlashcards(workspace.id, topic, 5);
      setCards(data.cards);
      setIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not generate flashcards for this concept.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SelectedSourcesBar />
      <div className="dashboard-header"><div className="header-title"><h2>Flashcards</h2><p>Review concepts from your selected sources with active recall.</p></div></div>
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card p-5"><div className="card-header"><h3>Concept Review</h3><span className="badge">Source Grounded</span></div>{concept && <div className="space-y-4 text-sm"><div><p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Concept</p><p className="font-semibold">{concept.display_name}</p></div><p className="text-theme-text leading-relaxed">{concept.description || 'No description was extracted for this concept.'}</p><div><p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Current Mastery</p><p className="font-semibold">{studentData?.topics[topic]?.mastery_score || 0}%</p></div><div><p className="text-theme-muted text-xs uppercase tracking-wider mb-1">Prerequisites</p><p>{concept.prerequisites.length ? concept.prerequisites.join(', ') : 'None'}</p></div></div>}</div>
            <div className="card p-5 xl:col-span-2"><div className="card-header"><h3>Active Recall Deck</h3><span className="badge">{cards.length ? `${index + 1} / ${cards.length}` : 'Ready'}</span></div>{!card ? <p className="text-sm text-theme-muted py-12">Generate a deck, try to recall the answer, then reveal it.</p> : <div className="space-y-4"><button type="button" onClick={() => setFlipped((value) => !value)} className="w-full min-h-56 border border-dashed border-theme-border rounded bg-theme-bg p-8 text-center text-base font-medium text-theme-text">{flipped ? card.back : card.front}</button><div className="flex flex-wrap gap-3"><button type="button" className="btn btn-secondary" onClick={() => setFlipped((value) => !value)}>{flipped ? 'Show Prompt' : 'Reveal Answer'}</button><button type="button" className="btn btn-primary" onClick={() => { setIndex((value) => (value + 1) % cards.length); setFlipped(false); }}>Next Card</button></div></div>}</div>
          </div>
        </>
      )}
    </div>
  );
};
