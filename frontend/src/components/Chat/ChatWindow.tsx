import React, { useEffect, useRef, useState } from 'react';
import client from '../../api/client';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  sourcesUsed?: string[];
  mastery?: { mastery_score: number; status: string; total_attempts: number } | null;
  isQuiz?: boolean;
  quizAnswered?: boolean;
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
  { id: 'explain',       label: 'Explain',         icon: '💡', desc: 'Simple explanation' },
  { id: 'step_by_step',  label: 'Step-by-Step',    icon: '📋', desc: 'Guided walkthrough' },
  { id: 'socratic',      label: 'Ask Questions',   icon: '🤔', desc: 'Socratic method' },
  { id: 'example',       label: 'Worked Example',  icon: '✏️', desc: 'Full example' },
  { id: 'flashcard',     label: 'Flashcards',      icon: '🃏', desc: 'Q&A pairs' },
  { id: 'test',          label: 'Test Me',          icon: '🎯', desc: 'Practice quiz' },
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

// ─── Markdown renderer (simple) ─────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ paddingLeft: 18, marginBottom: 8 }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 3, color: 'var(--text-primary)' }}>
              {renderInline(item.replace(/^[-*•]\s*/, ''))}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const level = line.match(/^(#{1,3})/)?.[1].length || 1;
      const text = line.replace(/^#{1,3}\s/, '');
      elements.push(
        <p key={i} style={{ fontWeight: 700, fontSize: level === 1 ? 15 : 13, marginBottom: 6, color: 'var(--text-primary)' }}>
          {renderInline(text)}
        </p>
      );
    } else if (/^[-*•]\s/.test(line)) {
      inList = true;
      listItems.push(line);
    } else if (/^\d+\.\s/.test(line)) {
      flushList();
      elements.push(
        <p key={i} style={{ marginBottom: 4, paddingLeft: 4, color: 'var(--text-primary)' }}>
          {renderInline(line)}
        </p>
      );
    } else if (line.trim() === '') {
      flushList();
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      flushList();
      elements.push(
        <p key={i} style={{ marginBottom: 5, lineHeight: 1.6, color: 'var(--text-primary)' }}>
          {renderInline(line)}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    // Inline code `text`
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ background: 'var(--swatch-2)', padding: '1px 5px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'monospace' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const MasteryBadge: React.FC<{ mastery: ChatMessage['mastery'] }> = ({ mastery }) => {
  if (!mastery) return null;
  const score = mastery.mastery_score;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: getMasteryBg(score),
      border: `1px solid ${getMasteryColor(score)}40`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, marginTop: 6,
    }}>
      <span style={{ color: getMasteryColor(score), fontWeight: 700 }}>
        {score}% mastery
      </span>
      <span style={{ color: 'var(--text-muted)' }}>·</span>
      <span style={{ color: 'var(--text-secondary)' }}>{mastery.total_attempts} attempts</span>
    </div>
  );
};

const SourceBadges: React.FC<{ sources: string[] }> = ({ sources }) => {
  if (!sources.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {sources.map((s) => (
        <span key={s} style={{
          background: 'var(--swatch-2)',
          border: '1px solid var(--border-soft)',
          borderRadius: 12, padding: '2px 8px',
          fontSize: 10, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          📄 {s.length > 30 ? s.slice(0, 28) + '…' : s}
        </span>
      ))}
    </div>
  );
};

const TypingIndicator = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 0' }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--swatch-3), var(--swatch-4))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, flexShrink: 0,
    }}>🧠</div>
    <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'var(--swatch-1)', borderRadius: '0 12px 12px 12px', border: '1px solid var(--border-soft)' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--swatch-4)',
          animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export const ChatWindow: React.FC<Props> = ({
  concept,
  conceptId,
  workspaceId,
  studentId = 'student-1',
  sourceIds = [],
  initialMode = 'explain',
}) => {
  const [mode, setMode] = useState<ModeId>(initialMode as ModeId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [misconceptions, setMisconceptions] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<Record<string, unknown> | null>(null);
  const [pendingQuiz, setPendingQuiz] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Reset when concept changes
  useEffect(() => {
    setMessages([]);
    historyRef.current = [];
    setPendingQuiz(null);
    setMisconceptions([]);

    if (concept) {
      const greeting = `Hello! I'm your Knowlify Tutor. Let's explore **${concept}** together. What would you like to do — shall I explain it, give you a worked example, or test your understanding?`;
      const greetMsg: ChatMessage = { id: uid(), role: 'assistant', content: greeting };
      setMessages([greetMsg]);
    }
  }, [conceptId, concept]);

  // Change mode
  const handleModeChange = (newMode: ModeId) => {
    setMode(newMode);
    const modeInfo = MODES.find(m => m.id === newMode)!;
    const prompt = `I've switched to **${modeInfo.label}** mode. ${modeInfo.desc}.`;
    const switchMsg: ChatMessage = {
      id: uid(), role: 'assistant', content: prompt,
    };
    setMessages(prev => [...prev, switchMsg]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // If there's a pending quiz and this is an answer, use the grade endpoint
    if (pendingQuiz && mode === 'test' && workspaceId && conceptId) {
      try {
        const res = await client.post('/api/chat/answer', {
          workspace_id: workspaceId,
          concept_id: conceptId,
          student_id: studentId,
          answer: text,
          question_context: pendingQuiz,
        });
        const { is_correct, explanation, mastery, recommendation: rec } = res.data;
        const feedback = is_correct
          ? `✅ **Correct!** ${explanation}`
          : `❌ **Not quite.** ${explanation}`;

        const botMsg: ChatMessage = {
          id: uid(), role: 'assistant', content: feedback,
          mastery, sourcesUsed: [],
        };
        setMessages(prev => [...prev, botMsg]);
        if (rec) setRecommendation(rec);
        setPendingQuiz(null);
      } catch {
        setMessages(prev => [...prev, {
          id: uid(), role: 'assistant',
          content: '⚠️ Could not grade your answer. Please try again.',
        }]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
      return;
    }

    // Normal chat
    try {
      historyRef.current = historyRef.current.slice(-18);

      const res = await client.post('/api/chat', {
        workspace_id: workspaceId,
        concept_id: conceptId,
        student_id: studentId,
        mode,
        message: text,
        history: historyRef.current,
        source_ids: sourceIds,
      });

      const { reply, sources_used, mastery, recommendation: rec, misconceptions: miscons } = res.data;

      historyRef.current.push({ role: 'user', content: text });
      historyRef.current.push({ role: 'assistant', content: reply });

      const isQuizMessage = mode === 'test' && !pendingQuiz;
      const botMsg: ChatMessage = {
        id: uid(), role: 'assistant', content: reply,
        mode, sourcesUsed: sources_used || [], mastery,
        isQuiz: isQuizMessage,
      };
      setMessages(prev => [...prev, botMsg]);

      if (rec) setRecommendation(rec);
      if (miscons?.length) setMisconceptions(miscons);

      if (isQuizMessage) {
        setPendingQuiz(reply);
      }

    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || 'Failed to connect to the tutoring model.';
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant',
        content: `⚠️ ${errMsg}`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickSend = (text: string) => sendMessage(text);

  // ─── Render ───────────────────────────────────────────────────────────────

  const weakPrereq = (recommendation as Record<string, unknown> | null)?.weakest_prerequisite as string | undefined;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 540, maxHeight: 700,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 10px',
        borderBottom: '1px solid var(--border-faint)',
        background: 'var(--swatch-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🧠</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {concept ? `Studying: ${concept}` : 'Knowlify Tutor'}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Adaptive AI · Grounded in your sources
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              title={m.desc}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: mode === m.id ? '1.5px solid var(--swatch-4)' : '1px solid var(--border-soft)',
                background: mode === m.id ? 'var(--swatch-4)' : 'var(--bg-card)',
                color: mode === m.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.18s ease',
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Banners */}
      {misconceptions.length > 0 && (
        <div style={{
          padding: '8px 16px', fontSize: 11,
          background: '#FDF6E9', borderBottom: '1px solid #E8D5A0',
          color: '#856404', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ⚠️ <span><strong>Misconceptions detected:</strong> {misconceptions.join(', ')} — your tutor will address these.</span>
        </div>
      )}
      {weakPrereq && (
        <div style={{
          padding: '8px 16px', fontSize: 11,
          background: '#EFF6FB', borderBottom: '1px solid #B8D8ED',
          color: '#0B5589', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🔒 <span><strong>Prerequisite gap:</strong> Consider reviewing <strong>{weakPrereq}</strong> first for a stronger foundation.</span>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'var(--bg-app)',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              {concept ? `Ready to explore ${concept}` : 'Select a concept to start'}
            </p>
            <p style={{ fontSize: 11 }}>Choose a learning mode above, then ask anything.</p>
            {concept && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                {[
                  { label: '💡 Explain this', text: `Explain ${concept} to me simply` },
                  { label: '✏️ Give an example', text: `Show me a worked example of ${concept}` },
                  { label: '🎯 Test my knowledge', text: `Quiz me on ${concept}` },
                ].map((q) => (
                  <button key={q.label} onClick={() => handleQuickSend(q.text)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: '1px solid var(--border-medium)', background: 'var(--bg-card)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}>
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start', gap: 8,
          }}>
            {/* Avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--swatch-3), var(--swatch-4))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, marginTop: 2,
              }}>🧠</div>
            )}

            <div style={{ maxWidth: '80%' }}>
              {/* Bubble */}
              <div style={{
                padding: '10px 14px',
                borderRadius: msg.role === 'user'
                  ? '14px 4px 14px 14px'
                  : '4px 14px 14px 14px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--swatch-4), #a8916a)'
                  : 'var(--bg-card)',
                border: msg.role === 'user'
                  ? 'none'
                  : '1px solid var(--border-faint)',
                boxShadow: 'var(--shadow-xs)',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              }}>
                {msg.role === 'user'
                  ? msg.content
                  : renderMarkdown(msg.content)
                }
              </div>

              {/* Source badges */}
              {msg.role === 'assistant' && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                <SourceBadges sources={msg.sourcesUsed} />
              )}

              {/* Mastery badge after quiz */}
              {msg.mastery && <MasteryBadge mastery={msg.mastery} />}

              {/* Quiz prompt label */}
              {msg.isQuiz && (
                <div style={{
                  marginTop: 6, fontSize: 10, color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}>
                  🎯 Type your answer below
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending quiz reminder */}
      {pendingQuiz && (
        <div style={{
          padding: '6px 16px', fontSize: 11,
          background: 'var(--unstarted-bg)', borderTop: '1px solid var(--unstarted-border)',
          color: 'var(--text-secondary)',
        }}>
          🎯 <strong>Quiz mode:</strong> Type your answer to the question above.
          <button
            onClick={() => { setPendingQuiz(null); }}
            style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Skip
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-faint)',
        background: 'var(--swatch-2)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pendingQuiz && mode === 'test'
              ? 'Type your answer...'
              : `Ask about ${concept || 'your sources'}...`
          }
          disabled={loading}
          style={{
            flex: 1, padding: '9px 14px', borderRadius: 24, fontSize: 12,
            border: '1px solid var(--border-soft)', background: 'var(--bg-card)',
            color: 'var(--text-primary)', outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--swatch-4)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-soft)'; }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '9px 18px', borderRadius: 24, fontSize: 12, fontWeight: 700,
            background: 'linear-gradient(135deg, var(--swatch-4), #a8916a)',
            color: '#fff', border: 'none', cursor: 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            transition: 'opacity 0.18s, transform 0.1s',
            flexShrink: 0,
          }}
          onMouseDown={(e) => { (e.target as HTMLElement).style.transform = 'scale(0.96)'; }}
          onMouseUp={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {loading ? '…' : 'Send →'}
        </button>
      </form>

      {/* CSS animation for typing dots */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
