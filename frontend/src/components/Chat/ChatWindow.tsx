import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import client from '../../api/client';
import { getChatHistory, clearChatHistory } from '../../api/chat';
import { useStudyStore } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';
import Markdown from '../shared/Markdown';
import ConceptPicker from '../shared/ConceptPicker';
import InlineQuizCard from '../shared/InlineQuizCard';
import InlineFlashcards from '../shared/InlineFlashcards';
import './chat.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface FlashcardItem {
  id: string;
  front: string;
  back: string;
}

interface QuizItem {
  id: string;
  concept_id: string;
  prompt: string;
  options: string[];
}

interface SuggestedAction {
  label: string;
  mode: ModeId;
  target_concept?: string | null;
  message: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  sourcesUsed?: string[];
  mastery?: { mastery_score: number; status: string; total_attempts: number } | null;
  flashcards?: FlashcardItem[] | null;
  quiz?: QuizItem | null;
  quizAnswered?: boolean;
  selectedQuizOption?: number | null;
  quizResult?: { is_correct: boolean; explanation: string; correct_answer: string } | null;
  suggestedActions?: SuggestedAction[];
}

interface Props {
  concept?: string;
  conceptId?: string;
  workspaceId?: string;
  studentId?: string;
  sourceIds?: string[];
  initialMode?: string;
  initialMessage?: string;
  onGenerateAction?: (mode: 'quiz' | 'flashcards' | 'notes' | 'study_guide', conceptId?: string | null) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MODES = [
  { id: 'explain',       label: 'Explain Simply', icon: '💡', desc: 'Simple, intuitive concept explanation' },
  { id: 'step_by_step',  label: 'Teach Step-by-Step', icon: '📋', desc: 'Guided walkthrough with checks' },
  { id: 'socratic',      label: 'Ask Me Questions', icon: '🤔', desc: 'Socratic dialogue to guide you' },
  { id: 'example',       label: 'Give Worked Example', icon: '✏️', desc: 'Step-by-step example problem' },
  { id: 'flashcard',     label: 'Make Flashcards', icon: '🃏', desc: 'Interactive recall cards' },
  { id: 'test',          label: 'Test Me', icon: '🎯', desc: 'Interactive practice quiz' },
] as const;

type ModeId = (typeof MODES)[number]['id'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function getMasteryColor(score: number): string {
  if (score >= 80) return 'var(--strong-hue)';
  if (score >= 50) return 'var(--medium-hue)';
  if (score > 0)   return 'var(--weak-hue)';
  return 'var(--unstarted-hue)';
}

function getMasteryBg(score: number): string {
  if (score >= 80) return 'var(--strong-bg)';
  if (score >= 50) return 'var(--medium-bg)';
  if (score > 0)   return 'var(--weak-bg)';
  return 'var(--unstarted-bg)';
}

function cleanWidgetIntroText(text: string, hasFlashcards?: boolean, hasQuiz?: boolean): string {
  if (!hasFlashcards && !hasQuiz) return text;

  const lines = text.split('\n');
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (hasFlashcards && /^(flashcard|card|front|back|question|answer)\s*:/i.test(trimmed)) return false;
      if (hasQuiz && /^(quiz|question|answer|correct answer|options?)\s*:/i.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

const MasteryProgressRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 16;
  const stroke = 3.5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="chat-mastery-ring">
      <svg height={radius * 2} width={radius * 2}>
        <circle
          stroke="var(--border-soft)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={getMasteryColor(score)}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.35s' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <span>{Math.round(score)}</span>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const ChatWindow: React.FC<Props> = ({
  concept: propConcept,
  conceptId: propConceptId,
  workspaceId,
  studentId = 'student-1',
  sourceIds = [],
  initialMode = 'explain',
  initialMessage,
  onGenerateAction,
}) => {
  const [mode, setMode] = useState<ModeId>(initialMode as ModeId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState({ attempts: 0, correct: 0 });

  // Store selections
  const graphData = useStudyStore((s) => s.graphData);
  const selectedNodeId = useStudyStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useStudyStore((s) => s.setSelectedNodeId);
  const studentData = useUserStore((s) => s.studentData);
  const fetchStudentData = useUserStore((s) => s.fetchStudentData);

  const activeConceptId = selectedNodeId || propConceptId || '';
  const conceptNode = graphData?.nodes.find(n => n.id === activeConceptId);
  const activeConceptName = conceptNode?.display_name || propConcept || '';

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const initialMessageRef = useRef<string | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const greetingMessage = (): ChatMessage => {
    const conceptLabel = activeConceptName ? `**${activeConceptName}**` : 'your workspace sources';
    return {
      id: uid(),
      role: 'assistant',
      content: `Hello! I'm your Knowlify Tutor. Let's study ${conceptLabel} together. Ask for an explanation here, or ask me to create a quiz, flashcards, notes, or a study guide and I will open it in Study Tools.`,
    };
  };

  // Load this user's persisted chat history for the active workspace. History
  // is keyed by workspace (not concept), so switching concepts keeps the thread.
  useEffect(() => {
    let cancelled = false;
    setSessionStats({ attempts: 0, correct: 0 });

    const showGreeting = () => {
      setMessages([greetingMessage()]);
      historyRef.current = [];
    };

    async function load() {
      if (!workspaceId) {
        showGreeting();
        return;
      }
      try {
        const hist = await getChatHistory(workspaceId);
        if (cancelled) return;
        if (hist.messages.length > 0) {
          setMessages(hist.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
          historyRef.current = hist.messages.map((m) => ({ role: m.role, content: m.content })).slice(-16);
        } else {
          showGreeting();
        }
      } catch {
        if (!cancelled) showGreeting();
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleClearChat = async () => {
    if (workspaceId) {
      try { await clearChatHistory(workspaceId); } catch { /* best effort */ }
    }
    setMessages([greetingMessage()]);
    historyRef.current = [];
    setSessionStats({ attempts: 0, correct: 0 });
  };

  // Synchronize initialMode changes
  useEffect(() => {
    if (initialMessage) return;
    if (initialMode && initialMode !== mode) {
      handleModeChange(initialMode as ModeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialMessage]);

  // Send a specific handoff prompt from another page, such as quiz review.
  useEffect(() => {
    if (!initialMessage) return;
    const handoffKey = `${activeConceptId}:${initialMode}:${initialMessage}`;
    if (initialMessageRef.current === handoffKey) return;

    initialMessageRef.current = handoffKey;
    const handoffMode = (initialMode || 'explain') as ModeId;
    setMode(handoffMode);
    window.setTimeout(() => {
      sendMessage(initialMessage, handoffMode);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, initialMode, activeConceptId]);

  const handleModeChange = (newMode: ModeId) => {
    if (newMode === 'test' || newMode === 'flashcard') {
      onGenerateAction?.(newMode === 'test' ? 'quiz' : 'flashcards', activeConceptId || null);
      return;
    }
    setMode(newMode);
    const modeInfo = MODES.find(m => m.id === newMode)!;

    // Automatically trigger action when switching mode
    const msgText = `Provide me a ${modeInfo.label.toLowerCase()} overview`;

    sendMessage(msgText, newMode);
  };

  const sendMessage = async (text: string, activeMode: ModeId = mode) => {
    if (!text.trim() || loading) return;
    const normalized = text.toLowerCase();
    const asksToCreate = /\b(create|generate|make|start|take|build|prepare)\b/.test(normalized);
    const requestedMaterial = /\bflashcards?\b/.test(normalized)
      ? 'flashcards'
      : /\bquiz(zes)?\b|\btest me\b/.test(normalized)
        ? 'quiz'
        : /\bstudy guide\b/.test(normalized)
          ? 'study_guide'
          : /\bnotes?\b/.test(normalized)
            ? 'notes'
            : null;
    if (asksToCreate && requestedMaterial && onGenerateAction) {
      setInput('');
      onGenerateAction(requestedMaterial, activeConceptId || null);
      return;
    }
    setInput('');

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      historyRef.current = historyRef.current.slice(-16);

      const res = await client.post('/api/chat', {
        workspace_id: workspaceId,
        concept_id: activeConceptId || null,
        student_id: studentId,
        mode: activeMode,
        message: text,
        history: historyRef.current,
        source_ids: sourceIds,
      });

      const { reply, sources_used, mastery, flashcards, quiz, suggested_actions } = res.data;

      historyRef.current.push({ role: 'user', content: text });
      historyRef.current.push({ role: 'assistant', content: reply });

      const botMsg: ChatMessage = {
        id: uid(), role: 'assistant', content: reply,
        mode: activeMode, sourcesUsed: sources_used || [], mastery,
        flashcards, quiz, suggestedActions: suggested_actions || [],
      };

      setMessages(prev => [...prev, botMsg]);
      await fetchStudentData();

    } catch (err: any) {
      const errMsg = err.response?.data?.detail || ' Tutoring model is offline. Please try again.';
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', content: `⚠️ ${errMsg}`
      }]);
    } finally {
      setLoading(false);
      textInputRef.current?.focus();
    }
  };

  const handleAnswerQuiz = async (msgId: string, questionId: string, optIdx: number, prompt: string) => {
    setLoading(true);
    try {
      const res = await client.post('/api/chat/answer', {
        workspace_id: workspaceId,
        concept_id: activeConceptId,
        student_id: studentId,
        answer: String(optIdx),
        question_id: questionId,
        question_context: prompt,
        difficulty: 'Medium',
      });

      const { is_correct, explanation, correct_answer } = res.data;

      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            quizAnswered: true,
            selectedQuizOption: optIdx,
            quizResult: { is_correct, explanation, correct_answer }
          };
        }
        return m;
      }));

      // Update local sessions stats
      setSessionStats(prev => ({
        attempts: prev.attempts + 1,
        correct: prev.correct + (is_correct ? 1 : 0)
      }));

      await fetchStudentData();

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfReportFlashcard = async (correct: boolean) => {
    // Record flashcard self-evaluation directly in the student model
    try {
      await client.post('/api/attempt', {
        student_id: studentId,
        topic_name: activeConceptId,
        question_id: `flashcard-self-${uid()}`,
        is_correct: correct,
        error_type: correct ? null : "Concept confusion",
        hints_used: 0,
        time_taken: 5,
      });
      await fetchStudentData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClearConcept = () => {
    setSelectedNodeId(null);
  };

  const handleSuggestedAction = (action: SuggestedAction) => {
    if (action.target_concept) {
      setSelectedNodeId(action.target_concept);
    }
    if (action.mode === 'test' || action.mode === 'flashcard') {
      onGenerateAction?.(action.mode === 'test' ? 'quiz' : 'flashcards', action.target_concept || activeConceptId || null);
      return;
    }
    setMode(action.mode);
    sendMessage(action.message, action.mode);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // ─── Render ───

  const selectedConceptMastery = studentData?.topics[activeConceptId]?.mastery_score || 0;
  const selectedConceptStatus = studentData?.topics[activeConceptId]?.status || 'Not Started';
  const weakTopics = studentData ? Object.keys(studentData.topics).filter(k => studentData.topics[k].status === 'Weak') : [];

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-row">
          <div className="chat-header-identity">
            <span className="chat-header-icon">🧠</span>
            <div className="chat-header-titles">
              {graphData?.nodes && graphData.nodes.length > 0 ? (
                <div className="chat-header-concept-row">
                  <ConceptPicker
                    value={activeConceptId}
                    onChange={() => { /* selection handled via syncSelectedNode */ }}
                    allowGeneral
                    className="chat-concept-select"
                    aria-label="Chat concept focus"
                  />
                  {activeConceptId && (
                    <button onClick={handleClearConcept} className="chat-concept-clear">
                      Clear
                    </button>
                  )}
                </div>
              ) : (
                <span className="chat-header-title">General Chat</span>
              )}
              <span className="chat-header-status">Adaptive Tutor Connection: Live</span>
            </div>
          </div>

          {/* Right cluster: clear-history + live mastery ring */}
          <div className="chat-header-tools">
            <button
              onClick={handleClearChat}
              title="Clear this workspace's chat history"
              className="chat-clear-btn"
            >
              🗑️ Clear chat
            </button>

            {activeConceptId && (
              <div className="chat-mastery">
                <div className="chat-mastery-meta">
                  <p>Concept Mastery</p>
                  <p style={{ color: getMasteryColor(selectedConceptMastery) }}>
                    {selectedConceptStatus}
                  </p>
                </div>
                <MasteryProgressRing score={selectedConceptMastery} />
              </div>
            )}
          </div>
        </div>

        {/* Mode Selector pills */}
        <div className="chat-mode-row">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              title={m.desc}
              className={`chat-mode-pill ${mode === m.id ? 'active' : ''}`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Messages Body */}
      <div className="chat-messages">
        {sessionStats.attempts > 0 && (
          <div className="chat-session-stats">
            <span>📊 <strong>Session Practice Metrics:</strong></span>
            <span>
              Answered: <strong>{sessionStats.attempts}</strong> | Correct:{' '}
              <strong className="correct">{sessionStats.correct}</strong>{' '}
              ({Math.round((sessionStats.correct / sessionStats.attempts) * 100)}%)
            </span>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="chat-msg-avatar" aria-hidden>🎓</div>
            )}

            <div className="chat-msg-body">
              <div className={`chat-bubble ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(msg.content)}
                    className="chat-copy-btn"
                    title="Copy response"
                  >
                    📋
                  </button>
                )}

                {msg.role === 'user'
                  ? msg.content
                  : <Markdown text={cleanWidgetIntroText(msg.content, Boolean(msg.flashcards?.length), Boolean(msg.quiz))} />}

                {msg.flashcards && msg.flashcards.length > 0 && (
                  <InlineFlashcards
                    cards={msg.flashcards}
                    onRate={(_cardId, known) => handleSelfReportFlashcard(known)}
                  />
                )}

                {msg.quiz && (
                  <InlineQuizCard
                    prompt={msg.quiz.prompt}
                    options={msg.quiz.options}
                    answered={Boolean(msg.quizAnswered)}
                    selected={msg.selectedQuizOption ?? null}
                    result={
                      msg.quizResult
                        ? {
                            isCorrect: msg.quizResult.is_correct,
                            explanation: msg.quizResult.explanation,
                            correctAnswer: msg.quizResult.correct_answer,
                          }
                        : null
                    }
                    onAnswer={(optIdx) => {
                      if (msg.quiz) handleAnswerQuiz(msg.id, msg.quiz.id, optIdx, msg.quiz.prompt);
                    }}
                    disabled={loading}
                  />
                )}

                {msg.role === 'assistant' && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="chat-action-row">
                    {msg.suggestedActions.map((action) => (
                      <button
                        key={`${msg.id}-${action.label}`}
                        onClick={() => handleSuggestedAction(action)}
                        className="chat-action-chip"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'assistant' && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                <div className="chat-source-row">
                  {msg.sourcesUsed.map(src => (
                    <span key={src} className="chat-source-chip">
                      📄 {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="chat-typing">Knowlify Tutor is compiling response...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Contextual Adaptive Chips */}
      <div className="chat-context-bar">
        {activeConceptId && (
          <>
            <span
              className="chat-context-chip"
              style={{ background: getMasteryBg(selectedConceptMastery), borderColor: getMasteryColor(selectedConceptMastery) }}
            >
              Mastery: {selectedConceptMastery}% ({selectedConceptStatus})
            </span>
            {weakTopics.length > 0 && (
              <span
                onClick={() => sendMessage(`Help me review my weak topics: ${weakTopics.slice(0, 3).join(', ')}`)}
                className="chat-warning-chip"
              >
                ⚠️ Weak Foundational Topics ({weakTopics.length})
              </span>
            )}
          </>
        )}
      </div>

      {/* Input Form — self-contained container with the send button nested inside */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="chat-input-form">
        <div className="chat-input-row">
          <textarea
            ref={textInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'test'
                ? 'Select an option above to answer the quiz!'
                : `Ask about ${activeConceptName || 'your sources'}... (Ctrl+Enter to send)`
            }
            rows={1}
            className="chat-input"
            onKeyDownCapture={handleTextareaKeyDown}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="chat-send-btn"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
