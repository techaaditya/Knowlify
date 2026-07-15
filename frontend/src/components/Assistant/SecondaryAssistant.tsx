import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Lightbulb, MessageCircleQuestion, Send, Trash2, X } from 'lucide-react';
import client, { getDueFlashcards } from '../../api/client';
import { useAssistantStore } from '../../store/assistantStore';
import { useSourcesStore } from '../../store/sourcesStore';
import { useStudyStore } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

export const SecondaryAssistant: React.FC = () => {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const studentId = useUserStore((state) => state.studentId);
  const studentData = useUserStore((state) => state.studentData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const selectedSourceIds = useSourcesStore((state) => state.selectedSourceIds);
  const isOpen = useAssistantStore((state) => state.isOpen);
  const messages = useAssistantStore((state) => state.messages);
  const pendingRequest = useAssistantStore((state) => state.pendingRequest);
  const toggle = useAssistantStore((state) => state.toggle);
  const close = useAssistantStore((state) => state.close);
  const addMessage = useAssistantStore((state) => state.addMessage);
  const clearPendingRequest = useAssistantStore((state) => state.clearPendingRequest);
  const clearWorkspace = useAssistantStore((state) => state.clearWorkspace);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const processedRequestRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const workspaceMessages = useMemo(
    () => messages.filter((item) => item.workspaceId === workspace?.id),
    [messages, workspace?.id],
  );
  const unreadCount = workspaceMessages.filter((item) => item.kind === 'notification').length;

  useEffect(() => {
    if (!workspace?.id) return;
    getDueFlashcards(studentId, workspace.id)
      .then((data) => {
        if (!data.due_reviews.length) return;
        addMessage({
          id: `due-${workspace.id}-${new Date().toISOString().slice(0, 10)}`,
          workspaceId: workspace.id,
          kind: 'notification',
          title: 'Flashcard review due',
          content: `${data.due_reviews.length} flashcard${data.due_reviews.length === 1 ? ' is' : 's are'} ready for review today.`,
        });
      })
      .catch(() => undefined);
  }, [addMessage, studentId, workspace?.id]);

  useEffect(() => {
    if (!workspace?.id || !studentData?.topics) return;
    const weak = Object.entries(studentData.topics)
      .filter(([, value]) => value.status === 'Weak')
      .map(([concept]) => concept);
    if (!weak.length) return;
    addMessage({
      id: `weak-${workspace.id}-${new Date().toISOString().slice(0, 10)}`,
      workspaceId: workspace.id,
      kind: 'notification',
      title: 'Study reminder',
      content: `Your next focused review should include ${weak.slice(0, 2).join(' and ')}.`,
    });
  }, [addMessage, studentData?.topics, workspace?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workspaceMessages, loading, isOpen]);

  const askAssistant = async (prompt: string, title?: string, conceptId?: string | null) => {
    if (!workspace?.id || !prompt.trim() || loading) return;
    addMessage({ workspaceId: workspace.id, kind: 'user', title, content: prompt });
    setLoading(true);
    try {
      const history = workspaceMessages
        .filter((item) => item.kind === 'user' || item.kind === 'assistant')
        .slice(-8)
        .map((item) => ({ role: item.kind === 'user' ? 'user' : 'assistant', content: item.content }));
      const response = await client.post('/api/chat', {
        workspace_id: workspace.id,
        concept_id: conceptId || selectedNodeId || null,
        student_id: studentId,
        mode: 'explain',
        message: prompt,
        history,
        source_ids: selectedSourceIds,
        persist: false,
      });
      addMessage({
        workspaceId: workspace.id,
        kind: 'assistant',
        title: title || 'Learning support',
        content: response.data.reply,
      });
    } catch (error: any) {
      addMessage({
        workspaceId: workspace.id,
        kind: 'assistant',
        title: 'Could not load explanation',
        content: error.response?.data?.detail || 'The learning assistant is unavailable right now. Your activity is still saved, so you can try again without losing your place.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingRequest || pendingRequest.workspaceId !== workspace?.id) return;
    if (processedRequestRef.current === pendingRequest.id) return;
    processedRequestRef.current = pendingRequest.id;
    clearPendingRequest();
    void askAssistant(pendingRequest.prompt, pendingRequest.title, pendingRequest.conceptId);
    // The request ID is the event boundary; other chat context remains live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest?.id, workspace?.id]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;
    setInput('');
    void askAssistant(prompt);
  };

  if (!workspace?.id) return null;

  return (
    <>
      {isOpen && (
        <section className="secondary-assistant" aria-label="Learning assistant">
          <header className="secondary-assistant-header">
            <div>
              <strong>Learning Assistant</strong>
              <span>Hints, explanations, and reminders</span>
            </div>
            <div className="secondary-assistant-header-actions">
              <button type="button" title="Clear assistant history" onClick={() => clearWorkspace(workspace.id)}><Trash2 size={15} /></button>
              <button type="button" title="Close learning assistant" onClick={close}><X size={17} /></button>
            </div>
          </header>
          <div className="secondary-assistant-messages">
            {!workspaceMessages.length && (
              <div className="secondary-assistant-empty">
                <MessageCircleQuestion size={25} />
                <strong>Ask without leaving your activity</strong>
                <p>Quiz explanations and progressive hints will appear here while your work stays open.</p>
              </div>
            )}
            {workspaceMessages.map((message) => (
              <article key={message.id} className={`assistant-message assistant-message-${message.kind}`}>
                <div className="assistant-message-icon">
                  {message.kind === 'notification' ? <Bell size={15} /> : message.kind === 'hint' ? <Lightbulb size={15} /> : <MessageCircleQuestion size={15} />}
                </div>
                <div>
                  {message.title && <strong>{message.title}</strong>}
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
            {loading && <p className="secondary-assistant-loading">Preparing a source-grounded explanation...</p>}
            <div ref={bottomRef} />
          </div>
          <form className="secondary-assistant-input" onSubmit={submit}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} placeholder="Ask about the current question..." />
            <button type="submit" title="Send question" disabled={!input.trim() || loading}><Send size={17} /></button>
          </form>
        </section>
      )}
      <button type="button" className="secondary-assistant-trigger" onClick={toggle} aria-label="Open learning assistant" title="Learning assistant">
        <MessageCircleQuestion size={22} />
        {unreadCount > 0 && <span>{Math.min(unreadCount, 9)}</span>}
      </button>
    </>
  );
};
