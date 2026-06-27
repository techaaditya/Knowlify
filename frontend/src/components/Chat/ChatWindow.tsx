import React, { useEffect, useRef, useState } from 'react';
import client from '../../api/client';
import { useStudyStore } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';

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
}

interface Props {
  concept?: string;
  conceptId?: string;
  workspaceId?: string;
  studentId?: string;
  sourceIds?: string[];
  initialMode?: string;
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

// ─── Markdown Renderer ─────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ paddingLeft: 18, marginBottom: 10, listStyleType: 'disc' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 4, color: 'var(--text-primary)', fontSize: '13px' }}>
              {renderInline(item.replace(/^[-*•]\s*/, ''))}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const level = line.match(/^(#{1,3})/)?.[1].length || 1;
      const textVal = line.replace(/^#{1,3}\s/, '');
      const fontSize = level === 1 ? '16px' : level === 2 ? '14px' : '13px';
      elements.push(
        <p key={i} style={{ fontWeight: 700, fontSize, marginTop: 10, marginBottom: 6, color: 'var(--text-primary)' }}>
          {renderInline(textVal)}
        </p>
      );
    } else if (/^[-*•]\s/.test(line)) {
      listItems.push(line);
    } else if (/^\d+\.\s/.test(line)) {
      flushList();
      elements.push(
        <p key={i} style={{ marginBottom: 6, paddingLeft: 4, color: 'var(--text-primary)', fontSize: '13px' }}>
          {renderInline(line)}
        </p>
      );
    } else if (line.trim() === '') {
      flushList();
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      flushList();
      elements.push(
        <p key={i} style={{ marginBottom: 6, lineHeight: 1.6, color: 'var(--text-primary)', fontSize: '13px' }}>
          {renderInline(line)}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ background: 'var(--swatch-2)', padding: '2px 5px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'monospace', color: '#c7254e' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

const MasteryProgressRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 16;
  const stroke = 3.5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <span style={{ position: 'absolute', fontSize: '9px', fontWeight: 700, color: 'var(--text-primary)' }}>
        {Math.round(score)}
      </span>
    </div>
  );
};

// ─── Interactive widgets ────────────────────────────────────────────────────

interface FlashcardWidgetProps {
  cards: FlashcardItem[];
  onSelfAttempt: (correct: boolean) => void;
}

const FlashcardWidget: React.FC<FlashcardWidgetProps> = ({ cards, onSelfAttempt }) => {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState<Record<number, 'known' | 'unknown'>>({});

  if (!cards.length) return null;
  const card = cards[idx];

  const handleRating = (known: boolean) => {
    setAnswered(prev => ({ ...prev, [idx]: known ? 'known' : 'unknown' }));
    onSelfAttempt(known);
    setTimeout(() => {
      if (idx < cards.length - 1) {
        setFlipped(false);
        setIdx(prev => prev + 1);
      }
    }, 400);
  };

  return (
    <div style={{ background: '#FFF', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 12, marginTop: 10, maxWidth: 360, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
        <span>Interactive Flashcard</span>
        <span>{idx + 1} / {cards.length}</span>
      </div>

      {/* 3D card wrapper */}
      <div 
        onClick={() => setFlipped(!flipped)}
        style={{
          perspective: 1000,
          cursor: 'pointer',
          height: 140,
          marginBottom: 12,
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'none',
        }}>
          {/* Front */}
          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            backfaceVisibility: 'hidden',
            background: 'var(--swatch-2)', border: '1px dashed var(--border-medium)',
            borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
          }}>
            {card.front}
          </div>
          {/* Back */}
          <div style={{
            position: 'absolute', width: '100%', height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'var(--bg-hover)', border: '1.5px solid var(--swatch-4)',
            borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', fontSize: '12px', color: 'var(--text-primary)', overflowY: 'auto',
          }}>
            {card.back}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <button onClick={() => setIdx(p => Math.max(0, p - 1))} disabled={idx === 0} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border-soft)', background: '#fff', cursor: 'pointer' }}>
          Prev
        </button>
        <button onClick={() => setFlipped(!flipped)} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 6, border: '1px solid var(--swatch-3)', background: 'var(--swatch-2)', cursor: 'pointer', fontWeight: 600 }}>
          Flip 🔃
        </button>
        <button onClick={() => setIdx(p => Math.min(cards.length - 1, p + 1))} disabled={idx === cards.length - 1} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border-soft)', background: '#fff', cursor: 'pointer' }}>
          Next
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, borderTop: '1.5px solid var(--border-faint)', paddingTop: 10 }}>
        <button 
          onClick={() => handleRating(false)}
          style={{
            flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 20, cursor: 'pointer', border: '1px solid var(--weak-border)',
            background: answered[idx] === 'unknown' ? 'var(--weak-bg)' : '#fff', color: 'var(--weak-hue)', fontWeight: 600,
          }}
        >
          Review Again ❌
        </button>
        <button 
          onClick={() => handleRating(true)}
          style={{
            flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 20, cursor: 'pointer', border: '1px solid var(--strong-border)',
            background: answered[idx] === 'known' ? 'var(--strong-bg)' : '#fff', color: 'var(--strong-hue)', fontWeight: 600,
          }}
        >
          I Know This! ✅
        </button>
      </div>
    </div>
  );
};


interface QuizWidgetProps {
  quiz: QuizItem;
  answered: boolean;
  selectedOption: number | null;
  result: ChatMessage['quizResult'];
  onAnswer: (idx: number) => void;
}

const QuizWidget: React.FC<QuizWidgetProps> = ({ quiz, answered, selectedOption, result, onAnswer }) => {
  return (
    <div style={{ background: '#FFF', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 14, marginTop: 10, maxWidth: 420, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
        <span>Practice Quiz Question</span>
        <span>Interactive Grade Loop</span>
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>{quiz.prompt}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {quiz.options.map((opt, i) => {
          let btnBg = '#fff';
          let btnBorder = 'var(--border-soft)';
          let btnColor = 'var(--text-primary)';

          if (answered) {
            const isSelected = selectedOption === i;
            const isCorrect = opt === result?.correct_answer;

            if (isCorrect) {
              btnBg = 'var(--strong-bg)';
              btnBorder = 'var(--strong-hue)';
              btnColor = 'var(--strong-hue)';
            } else if (isSelected) {
              btnBg = 'var(--weak-bg)';
              btnBorder = 'var(--weak-hue)';
              btnColor = 'var(--weak-hue)';
            }
          } else if (selectedOption === i) {
            btnBg = 'var(--swatch-2)';
            btnBorder = 'var(--swatch-4)';
          }

          return (
            <button
              key={i}
              onClick={() => !answered && onAnswer(i)}
              disabled={answered}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, fontSize: 12,
                border: `1.5px solid ${btnBorder}`, background: btnBg, color: btnColor,
                cursor: answered ? 'default' : 'pointer', transition: 'all 0.15s ease',
                fontWeight: selectedOption === i || (answered && opt === result?.correct_answer) ? 600 : 400,
              }}
            >
              <strong>{String.fromCharCode(65 + i)}.</strong> {opt}
            </button>
          );
        })}
      </div>

      {answered && result && (
        <div style={{
          marginTop: 12, padding: 10, borderRadius: 8,
          background: result.is_correct ? 'var(--strong-bg)' : 'var(--weak-bg)',
          border: `1px solid ${result.is_correct ? 'var(--strong-border)' : 'var(--weak-border)'}`,
          fontSize: 11.5, color: 'var(--text-primary)',
        }}>
          <strong>{result.is_correct ? '✅ Correct' : '❌ Incorrect'}</strong>
          <p style={{ marginTop: 4, lineHeight: 1.4 }}>{result.explanation}</p>
        </div>
      )}
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle starter greeting
  useEffect(() => {
    setMessages([]);
    historyRef.current = [];
    setSessionStats({ attempts: 0, correct: 0 });

    const conceptLabel = activeConceptName ? `**${activeConceptName}**` : 'your workspace sources';
    const greeting = `Hello! I'm your Knowlify Tutor. Let's study ${conceptLabel} together. You can choose a mode above (like Explain, Quiz, or Flashcards) to get started!`;
    setMessages([{ id: uid(), role: 'assistant', content: greeting }]);
  }, [activeConceptId, activeConceptName]);

  // Synchronize initialMode changes
  useEffect(() => {
    if (initialMode && initialMode !== mode) {
      handleModeChange(initialMode as ModeId);
    }
  }, [initialMode]);

  const handleModeChange = (newMode: ModeId) => {
    setMode(newMode);
    const modeInfo = MODES.find(m => m.id === newMode)!;
    
    // Automatically trigger action when switching mode
    const msgText = newMode === 'test' 
      ? `Start a quiz question about ${activeConceptName || 'workspace'}`
      : newMode === 'flashcard'
      ? `Generate flashcards for ${activeConceptName || 'workspace'}`
      : `Provide me a ${modeInfo.label.toLowerCase()} overview`;
      
    sendMessage(msgText, newMode);
  };

  const sendMessage = async (text: string, activeMode: ModeId = mode) => {
    if (!text.trim() || loading) return;
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

      const { reply, sources_used, mastery, flashcards, quiz } = res.data;

      historyRef.current.push({ role: 'user', content: text });
      historyRef.current.push({ role: 'assistant', content: reply });

      const botMsg: ChatMessage = {
        id: uid(), role: 'assistant', content: reply,
        mode: activeMode, sourcesUsed: sources_used || [], mastery,
        flashcards, quiz,
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // ─── Render ───

  const selectedConceptMastery = studentData?.topics[activeConceptId]?.mastery_score || 0;
  const selectedConceptStatus = studentData?.topics[activeConceptId]?.status || 'Not Started';
  const weakTopics = studentData ? Object.keys(studentData.topics).filter(k => studentData.topics[k].status === 'Weak') : [];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-card)', border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)',
    }}>
      {/* Premium Header */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-faint)', background: 'var(--swatch-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Concept Selector Dropdown built inside Header */}
              {graphData?.nodes && graphData.nodes.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={activeConceptId}
                    onChange={(e) => setSelectedNodeId(e.target.value || null)}
                    style={{
                      fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)',
                      background: 'transparent', border: 'none', paddingRight: 4, cursor: 'pointer',
                      outline: 'none', maxWidth: 180,
                    }}
                  >
                    <option value="">💬 General Chat (All Sources)</option>
                    {graphData.nodes.map(node => (
                      <option key={node.id} value={node.id}>
                        {node.display_name}
                      </option>
                    ))}
                  </select>
                  {activeConceptId && (
                    <button 
                      onClick={handleClearConcept}
                      style={{ fontSize: 10, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>General Chat</span>
              )}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                Adaptive Tutor Connection: Live
              </span>
            </div>
          </div>

          {/* Live Mastery Ring */}
          {activeConceptId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Concept Mastery</p>
                <p style={{ fontSize: '11px', fontWeight: 700, color: getMasteryColor(selectedConceptMastery) }}>
                  {selectedConceptStatus}
                </p>
              </div>
              <MasteryProgressRing score={selectedConceptMastery} />
            </div>
          )}
        </div>

        {/* Mode Selector pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              title={m.desc}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                border: mode === m.id ? '1.5px solid var(--swatch-4)' : '1.5px solid var(--border-soft)',
                background: mode === m.id ? 'var(--swatch-4)' : '#fff',
                color: mode === m.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Messages Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        
        {/* Session Collapsible Stat Panel */}
        {sessionStats.attempts > 0 && (
          <div style={{
            background: 'var(--swatch-2)', border: '1px solid var(--border-soft)',
            borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)'
          }}>
            <span>📊 <strong>Session Practice Metrics:</strong></span>
            <span>Answered: <strong>{sessionStats.attempts}</strong> | Correct: <strong style={{ color: 'var(--strong-hue)' }}>{sessionStats.correct}</strong> ({Math.round((sessionStats.correct / sessionStats.attempts) * 100)}%)</span>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start', gap: 8,
          }}>
            {/* Avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--swatch-3), var(--swatch-4))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🎓</div>
            )}

            <div style={{ maxWidth: '80%' }}>
              {/* Chat Bubble */}
              <div style={{
                padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user' ? 'var(--swatch-4)' : '#fff',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-faint)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                boxShadow: 'var(--shadow-xs)', position: 'relative',
              }}>
                {/* Copy button on hover for assistant messages */}
                {msg.role === 'assistant' && (
                  <button 
                    onClick={() => copyToClipboard(msg.content)}
                    style={{
                      position: 'absolute', top: 4, right: 6, opacity: 0.4, border: 'none', background: 'none',
                      cursor: 'pointer', fontSize: 10, display: 'inline-block'
                    }}
                    title="Copy response"
                  >
                    📋
                  </button>
                )}

                {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}

                {/* Render Interactive Flashcards widget if present */}
                {msg.flashcards && msg.flashcards.length > 0 && (
                  <FlashcardWidget cards={msg.flashcards} onSelfAttempt={handleSelfReportFlashcard} />
                )}

                {/* Render Interactive Quiz widget if present */}
                {msg.quiz && (
                  <QuizWidget
                    quiz={msg.quiz}
                    answered={Boolean(msg.quizAnswered)}
                    selectedOption={msg.selectedQuizOption ?? null}
                    result={msg.quizResult}
                    onAnswer={(optIdx) => {
                      if (msg.quiz) handleAnswerQuiz(msg.id, msg.quiz.id, optIdx, msg.quiz.prompt);
                    }}
                  />
                )}
              </div>

              {/* Source badges */}
              {msg.role === 'assistant' && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {msg.sourcesUsed.map(src => (
                    <span key={src} style={{ fontSize: 9, background: 'var(--swatch-2)', border: '1px solid var(--border-soft)', padding: '2px 6px', borderRadius: 10, color: 'var(--text-muted)' }}>
                      📄 {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 40 }}>Knowlify Tutor is compiling response...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Contextual Adaptive Chips */}
      <div style={{ padding: '4px 16px', background: 'var(--swatch-1)', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border-faint)' }}>
        {activeConceptId && (
          <>
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)', background: getMasteryBg(selectedConceptMastery), border: `1px solid ${getMasteryColor(selectedConceptMastery)}`, padding: '2px 8px', borderRadius: 10 }}>
              Mastery: {selectedConceptMastery}% ({selectedConceptStatus})
            </span>
            {weakTopics.length > 0 && (
              <span onClick={() => sendMessage(`Help me review my weak topics: ${weakTopics.slice(0,3).join(', ')}`)} style={{ fontSize: 9.5, cursor: 'pointer', color: '#856404', background: '#FDF6E9', border: '1px solid #E8D5A0', padding: '2px 8px', borderRadius: 10 }}>
                ⚠️ Weak Foundational Topics ({weakTopics.length})
              </span>
            )}
          </>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} style={{ padding: 12, display: 'flex', gap: 8, background: 'var(--swatch-2)', borderTop: '1px solid var(--border-soft)' }}>
        <textarea
          ref={textInputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleClearConcept}
          placeholder={
            mode === 'test' 
              ? 'Select an option above to answer the quiz!' 
              : `Ask about ${activeConceptName || 'your sources'}... (Ctrl+Enter to send)`
          }
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20, fontSize: 12.5,
            border: '1px solid var(--border-soft)', background: '#FFF',
            color: 'var(--text-primary)', outline: 'none', resize: 'none',
            fontFamily: 'inherit', lineHeight: 1.4,
          }}
          onKeyDownCapture={handleTextareaKeyDown}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: 'var(--swatch-4)', color: '#FFF', border: 'none', cursor: 'pointer',
            opacity: loading || !input.trim() ? 0.6 : 1, transition: 'all 0.15s ease',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};
