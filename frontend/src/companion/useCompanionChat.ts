/**
 * useCompanionChat — the companion's voice.
 *
 * Speaks to the same `/api/chat` tutor endpoint the Study tab uses, so every
 * conversation is source-grounded and updates the student model. Layers the
 * mentor personality on top: thinking while it works, teaching when it
 * answers, celebrating right answers, gently concerned about wrong ones.
 *
 * The API is a set of plain module-level functions (not component-bound
 * callbacks): the companion is a single global conversation, so any surface
 * (the dock, the quiz arena, the knowledge graph side panel) that triggers a
 * message must share the same outgoing-history buffer and the same
 * `useCompanionStore` state — a component-local `useRef` would silently reset
 * that context every time a different component called the hook.
 */
import client from '../api/client';
import { useSourcesStore } from '../store/sourcesStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { buildGreeting, composerActions, humanizeConcept, uid } from './brain';
import { makeMessage, useCompanionStore } from './store';
import { useQuizArenaStore } from './quizArenaStore';
import type { CompanionAction, CompanionChatMessage } from './types';

/** Quiz-style actions take over the screen with the full Quiz Arena. */
const isQuizAction = (a: CompanionAction): boolean =>
  a.intent === 'take_quiz' || a.intent === 'challenge' || a.mode === 'test';

interface RawSuggestedAction {
  label: string;
  mode: string;
  target_concept?: string | null;
  message: string;
}

interface ChatReply {
  reply: string;
  sources_used?: string[];
  mastery?: { mastery_score: number; status: string; total_attempts: number } | null;
  flashcards?: Array<{ id: string; front: string; back: string }> | null;
  quiz?: { id: string; concept_id: string; prompt: string; options: string[] } | null;
  suggested_actions?: RawSuggestedAction[];
}

const mapBackendActions = (raw: RawSuggestedAction[] | undefined): CompanionAction[] =>
  (raw ?? []).map((a) => ({
    id: uid('a'),
    intent: 'ask',
    label: a.label,
    mode: a.mode,
    conceptId: a.target_concept ?? undefined,
    prompt: a.message,
  }));

export interface CompanionChatApi {
  /** Send free-form text (or an action's prompt) to the tutor. */
  send: (text: string, opts?: { mode?: string; conceptId?: string | null }) => Promise<void>;
  /** Run a suggested/quick action chip. */
  runAction: (action: CompanionAction) => Promise<void>;
  /** Answer an inline quiz option. */
  answerQuiz: (messageId: string, optionIndex: number) => Promise<void>;
  /** Post the personalised greeting (first open of a session). */
  greet: () => void;
  /** Contextual quick actions for the composer row. */
  quickActions: () => CompanionAction[];
}

// Shared across every caller — this is the one true conversation transcript.
let history: Array<{ role: string; content: string }> = [];

const send = async (text: string, opts?: { mode?: string; conceptId?: string | null }): Promise<void> => {
  const trimmed = text.trim();
  const store = useCompanionStore.getState();
  if (!trimmed || store.sending) return;

  const workspaceId = useWorkspaceStore.getState().workspace?.id;
  const studentId = useUserStore.getState().studentId;
  const selectedSourceIds = useSourcesStore.getState().selectedSourceIds;

  store.addMessage(makeMessage('user', trimmed));
  store.setSending(true);
  store.setEmotion('thinking');

  try {
    history = history.slice(-16);

    const res = await client.post<ChatReply>('/api/chat', {
      workspace_id: workspaceId,
      concept_id: opts?.conceptId ?? null,
      student_id: studentId,
      mode: opts?.mode ?? 'explain',
      message: trimmed,
      history,
      source_ids: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
    });

    const { reply, sources_used, flashcards, quiz, suggested_actions } = res.data;
    history.push({ role: 'user', content: trimmed });
    history.push({ role: 'assistant', content: reply });

    store.addMessage(
      makeMessage('assistant', reply, {
        emotion: 'teaching',
        sources: (sources_used ?? []).map((name) => ({ name })),
        actions: mapBackendActions(suggested_actions),
        quiz: quiz
          ? { id: quiz.id, conceptId: quiz.concept_id, prompt: quiz.prompt, options: quiz.options }
          : null,
        flashcards: flashcards ?? null,
      }),
    );
    store.setEmotion('teaching', 6000);

    // Refresh the student model so mastery-driven reactions stay live.
    useUserStore.getState().fetchStudentData();
  } catch (err) {
    const detail =
      (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
      "I couldn't reach the tutoring model just now. Give it a moment and try again?";
    useCompanionStore.getState().addMessage(
      makeMessage('assistant', `⚠️ ${detail}`, { emotion: 'concerned' }),
    );
    useCompanionStore.getState().setEmotion('concerned', 4000);
  } finally {
    useCompanionStore.getState().setSending(false);
  }
};

const runAction = async (action: CompanionAction): Promise<void> => {
  // Quiz / challenge actions launch the full-screen Quiz Arena.
  if (isQuizAction(action)) {
    useQuizArenaStore.getState().launch({
      conceptId: action.conceptId ?? null,
      conceptName: action.conceptId ? humanizeConcept(action.conceptId) : null,
      difficulty: action.intent === 'challenge' ? 'Hard' : 'Medium',
      autoStart: Boolean(action.conceptId),
    });
    return;
  }
  // Everything else is a tutor conversation — make sure the panel is open.
  useCompanionStore.getState().open();
  await send(action.prompt || action.label, { mode: action.mode, conceptId: action.conceptId });
};

const answerQuiz = async (messageId: string, optionIndex: number): Promise<void> => {
  const store = useCompanionStore.getState();
  const msg = store.messages.find((m) => m.id === messageId);
  if (!msg?.quiz || msg.quizState?.answered || store.sending) return;

  const workspaceId = useWorkspaceStore.getState().workspace?.id;
  const studentId = useUserStore.getState().studentId;

  store.updateMessage(messageId, { quizState: { answered: true, selected: optionIndex } });
  store.setSending(true);
  store.setEmotion('thinking');

  try {
    const res = await client.post<{
      is_correct: boolean;
      explanation: string;
      correct_answer: string;
    }>('/api/chat/answer', {
      workspace_id: workspaceId,
      concept_id: msg.quiz.conceptId,
      student_id: studentId,
      answer: String(optionIndex),
      question_id: msg.quiz.id,
      question_context: msg.quiz.prompt,
      difficulty: 'Medium',
    });

    const { is_correct, explanation, correct_answer } = res.data;
    store.updateMessage(messageId, {
      quizState: {
        answered: true,
        selected: optionIndex,
        isCorrect: is_correct,
        explanation,
        correctAnswer: correct_answer,
      },
    });

    if (is_correct) {
      store.celebrate();
      store.setEmotion('celebrating', 5000);
      store.addMessage(makeMessage('assistant', 'Fantastic! 🎉 Ready for the next challenge?', { emotion: 'celebrating' }));
    } else {
      store.setEmotion('concerned', 5000);
      store.addMessage(
        makeMessage('assistant', "No worries — that's how learning works. Let's understand what went wrong together.", {
          emotion: 'concerned',
        }),
      );
    }
    useUserStore.getState().fetchStudentData();
  } catch {
    store.updateMessage(messageId, { quizState: undefined });
    store.setEmotion('concerned', 3000);
  } finally {
    store.setSending(false);
  }
};

const greet = (): void => {
  const store = useCompanionStore.getState();
  if (store.hasGreeted || !store.snapshot) return;
  const g = buildGreeting(store.snapshot);
  store.addMessage(makeMessage('assistant', g.text, { emotion: g.emotion, actions: g.actions }));
  store.setEmotion(g.emotion, g.emotion === 'celebrating' ? 5000 : 4000);
  store.markGreeted();
};

const quickActions = (): CompanionAction[] => {
  const snap = useCompanionStore.getState().snapshot;
  return snap ? composerActions(snap) : [];
};

const companionChatApi: CompanionChatApi = { send, runAction, answerQuiz, greet, quickActions };

/** Any component may call this — every caller shares the same conversation. */
export const useCompanionChat = (): CompanionChatApi => companionChatApi;

export type { CompanionChatMessage };
