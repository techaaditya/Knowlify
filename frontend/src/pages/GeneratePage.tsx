import React, { useEffect, useState } from 'react';
import { BookOpen, ClipboardCheck, FileText, History, Layers3, X } from 'lucide-react';
import {
  GeneratedArtifact,
  generateWrittenMaterial,
  getGenerationHistory,
} from '../api/client';
import { SelectedSourcesBar } from '../components/Sources/SelectedSourcesBar';
import { ConceptPicker } from '../components/shared/ConceptPicker';
import { useAutoGenerate } from '../components/shared/useAutoGenerate';
import { useSourcesStore } from '../store/sourcesStore';
import { useStudyStore } from '../store/studyStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { FlashcardsPage } from './FlashcardsPage';
import { QuizPage } from './QuizPage';

export type GenerateMode = 'quiz' | 'flashcards' | 'notes' | 'study_guide';

const modes: Array<{ id: GenerateMode; label: string; icon: React.ReactNode }> = [
  { id: 'quiz', label: 'Quiz', icon: <ClipboardCheck size={17} /> },
  { id: 'flashcards', label: 'Flashcards', icon: <Layers3 size={17} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={17} /> },
  { id: 'study_guide', label: 'Study Guide', icon: <BookOpen size={17} /> },
];

const WrittenMaterial: React.FC<{
  type: 'notes' | 'study_guide';
  onGenerated: () => void;
  autoGenerateKey?: number;
  autoConceptId?: string | null;
  onAutoGenerateConsumed?: () => void;
}> = ({ type, onGenerated, autoGenerateKey, autoConceptId, onAutoGenerateConsumed }) => {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const selectedSources = useSourcesStore((state) => state.getSelectedSources());
  const [topic, setTopic] = useState('');
  const [artifact, setArtifact] = useState<GeneratedArtifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (graphData?.nodes.length) setTopic(selectedNodeId || graphData.nodes[0].id);
  }, [graphData, selectedNodeId]);

  const generate = async () => {
    if (!workspace?.id || !topic) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateWrittenMaterial(workspace.id, topic, type);
      setArtifact(result);
      onGenerated();
    } catch (err: any) {
      setError(err.response?.data?.detail || `Could not generate ${type === 'notes' ? 'notes' : 'a study guide'}.`);
    } finally {
      setLoading(false);
    }
  };

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
    run: generate,
  });

  if (!selectedSources.length) return <div className="card p-8 text-center text-theme-muted text-sm">Select processed sources first.</div>;
  if (!graphData?.nodes.length) return <div className="card p-8 text-center text-theme-muted text-sm">The selected sources do not have a knowledge graph yet.</div>;

  const sections = (artifact?.content.sections || []) as Array<{ heading: string; body?: string; bullets?: string[] }>;
  return (
    <div className="space-y-5">
      <SelectedSourcesBar />
      <div className="card p-5 generate-material-controls">
        <div className="form-group mb-0">
          <label htmlFor={`${type}-topic`}>Concept</label>
          <ConceptPicker
            id={`${type}-topic`}
            className="form-control"
            value={topic}
            onChange={(conceptId) => { setTopic(conceptId); setArtifact(null); }}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : `Generate ${type === 'notes' ? 'Notes' : 'Study Guide'}`}
        </button>
      </div>
      {error && <div className="recommendation-box revision-needed">{error}</div>}
      {!artifact ? (
        <div className="card generate-material-empty">
          {type === 'notes' ? <FileText size={34} /> : <BookOpen size={34} />}
          <h3>{type === 'notes' ? 'Build concise concept notes' : 'Build a guided study plan'}</h3>
          <p>Knowlify will organize the selected source evidence around the concept and save the result in History.</p>
        </div>
      ) : (
        <article className="card generated-document">
          <header>
            <div>
              <span className="badge">{type === 'notes' ? 'Notes' : 'Study Guide'}</span>
              <h3>{artifact.title}</h3>
            </div>
            <span className="text-xs text-theme-muted">Saved to History</span>
          </header>
          {sections.map((section) => (
            <section key={section.heading}>
              <h4>{section.heading}</h4>
              {section.body && <p>{section.body}</p>}
              {Boolean(section.bullets?.length) && <ul>{section.bullets?.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
          {Boolean(artifact.content.sources?.length) && <footer>Sources: {artifact.content.sources.join(', ')}</footer>}
        </article>
      )}
    </div>
  );
};

interface PendingGenerateRequest {
  id: number;
  mode: GenerateMode;
  conceptId?: string | null;
}

export const GeneratePage: React.FC<{
  initialMode: GenerateMode;
  pendingRequest?: PendingGenerateRequest | null;
  onConsumeRequest?: () => void;
}> = ({ initialMode, pendingRequest, onConsumeRequest }) => {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const [activeMode, setActiveMode] = useState<GenerateMode>(initialMode);
  const [history, setHistory] = useState<GeneratedArtifact[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<GeneratedArtifact | null>(null);

  useEffect(() => setActiveMode(initialMode), [initialMode]);

  const refreshHistory = () => {
    if (!workspace?.id) return;
    getGenerationHistory(workspace.id)
      .then((data) => setHistory(data.artifacts))
      .catch(() => setHistory([]));
  };

  useEffect(refreshHistory, [workspace?.id]);

  return (
    <div className="space-y-6">
      <div className="dashboard-header generate-header">
        <div className="header-title">
          <h2>Study Tools</h2>
          <p>Create and revisit source-grounded learning materials from this workspace.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setHistoryOpen((value) => !value)}>
          <History size={17} /> History <span className="badge">{history.length}</span>
        </button>
      </div>
      <div className="generate-mode-tabs" role="tablist" aria-label="Learning material type">
        {modes.map((mode) => (
          <button key={mode.id} type="button" role="tab" aria-selected={activeMode === mode.id} className={activeMode === mode.id ? 'active' : ''} onClick={() => setActiveMode(mode.id)}>
            {mode.icon}<span>{mode.label}</span>
          </button>
        ))}
      </div>
      {historyOpen && (
        <section className="card generation-history">
          <div className="card-header">
            <div><h3>Generation History</h3><p className="text-xs text-theme-muted">Past work saved for this workspace.</p></div>
            <button type="button" className="icon-button" onClick={() => setHistoryOpen(false)} title="Close history"><X size={17} /></button>
          </div>
          {!history.length ? <p className="text-sm text-theme-muted">Nothing has been generated in this workspace yet.</p> : (
            <div className="generation-history-list">
              {history.map((item) => (
                <button type="button" key={item.id} onClick={() => setSelectedArtifact(selectedArtifact?.id === item.id ? null : item)} className={selectedArtifact?.id === item.id ? 'active' : ''}>
                  <span className="badge">{item.artifact_type.replace('_', ' ')}</span>
                  <strong>{item.title}</strong>
                  <small>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Saved'}</small>
                </button>
              ))}
            </div>
          )}
          {selectedArtifact && <ArtifactPreview artifact={selectedArtifact} />}
        </section>
      )}
      {activeMode === 'quiz' && (
        <QuizPage
          embedded
          onGenerated={refreshHistory}
          autoGenerateKey={pendingRequest?.mode === 'quiz' ? pendingRequest.id : undefined}
          autoConceptId={pendingRequest?.mode === 'quiz' ? pendingRequest.conceptId : undefined}
          onAutoGenerateConsumed={onConsumeRequest}
        />
      )}
      {activeMode === 'flashcards' && (
        <FlashcardsPage
          embedded
          onGenerated={refreshHistory}
          autoGenerateKey={pendingRequest?.mode === 'flashcards' ? pendingRequest.id : undefined}
          autoConceptId={pendingRequest?.mode === 'flashcards' ? pendingRequest.conceptId : undefined}
          onAutoGenerateConsumed={onConsumeRequest}
        />
      )}
      {activeMode === 'notes' && (
        <WrittenMaterial
          type="notes"
          onGenerated={refreshHistory}
          autoGenerateKey={pendingRequest?.mode === 'notes' ? pendingRequest.id : undefined}
          autoConceptId={pendingRequest?.mode === 'notes' ? pendingRequest.conceptId : undefined}
          onAutoGenerateConsumed={onConsumeRequest}
        />
      )}
      {activeMode === 'study_guide' && (
        <WrittenMaterial
          type="study_guide"
          onGenerated={refreshHistory}
          autoGenerateKey={pendingRequest?.mode === 'study_guide' ? pendingRequest.id : undefined}
          autoConceptId={pendingRequest?.mode === 'study_guide' ? pendingRequest.conceptId : undefined}
          onAutoGenerateConsumed={onConsumeRequest}
        />
      )}
    </div>
  );
};

const ArtifactPreview: React.FC<{ artifact: GeneratedArtifact }> = ({ artifact }) => {
  const questions = (artifact.content.questions || []) as Array<{ prompt: string }>;
  const cards = (artifact.content.cards || []) as Array<{ front: string; back: string }>;
  const sections = (artifact.content.sections || []) as Array<{ heading: string; body?: string }>;
  return (
    <div className="generation-history-preview">
      <h4>{artifact.title}</h4>
      {questions.map((item, index) => <p key={`${index}-${item.prompt}`}><strong>{index + 1}.</strong> {item.prompt}</p>)}
      {cards.map((item, index) => <p key={`${index}-${item.front}`}><strong>{item.front}</strong><br />{item.back}</p>)}
      {sections.map((item) => <p key={item.heading}><strong>{item.heading}</strong><br />{item.body}</p>)}
    </div>
  );
};
