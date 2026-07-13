/**
 * useCompanionData — the companion's senses.
 *
 * Watches the existing Zustand stores + the dashboard engine and distills them
 * into a {@link LearningSnapshot}, then feeds the brain's derivations
 * (baseline emotion, gamification, proactive nudges, mastery celebrations)
 * into the companion store. Mount once, anywhere inside the authed app.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDashboardEngineSummary, type DashboardEngineSummary } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import {
  MASTERED,
  deriveBaselineEmotion,
  deriveGamification,
  deriveNudges,
  humanizeConcept,
  norm01,
  uid,
} from './brain';
import { makeMessage, useCompanionStore } from './store';
import type { ConceptRef, LearningSnapshot } from './types';

const SLEEP_AFTER_MS = 5 * 60 * 1000; // no interaction → doze off
const NUDGE_DELAY_MS = 2600; // let the UI settle before speaking up
const SUMMARY_REFRESH_MS = 90_000;

const seenMasteryKey = (studentId: string) => `knowlify_companion_mastery_${studentId}`;

const loadSeenMastery = (studentId: string): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(seenMasteryKey(studentId)) || '{}');
  } catch {
    return {};
  }
};

const saveSeenMastery = (studentId: string, map: Record<string, number>) => {
  try {
    localStorage.setItem(seenMasteryKey(studentId), JSON.stringify(map));
  } catch {
    /* storage full/blocked — celebrations just repeat, harmless */
  }
};

/** Consecutive study days ending today/yesterday, from the engine heatmap. */
const deriveStreak = (heatmap: Array<{ date: string; attempts: number }>): { streak: number; daysSinceActive: number | null } => {
  const active = new Set(
    heatmap.filter((d) => d.attempts > 0).map((d) => d.date.slice(0, 10)),
  );
  if (active.size === 0) return { streak: 0, daysSinceActive: null };

  const dayMs = 86_400_000;
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  let daysSinceActive: number | null = null;
  for (let i = 0; i < 60; i++) {
    if (active.has(iso(new Date(today.getTime() - i * dayMs)))) {
      daysSinceActive = i;
      break;
    }
  }
  if (daysSinceActive == null) return { streak: 0, daysSinceActive: null };

  let streak = 0;
  // A streak survives if the last active day was today or yesterday.
  const anchor = daysSinceActive <= 1 ? daysSinceActive : null;
  if (anchor != null) {
    for (let i = anchor; i < 365; i++) {
      if (active.has(iso(new Date(today.getTime() - i * dayMs)))) streak += 1;
      else break;
    }
  }
  return { streak, daysSinceActive };
};

export const useCompanionData = (): void => {
  const authUser = useAuthStore((s) => s.user);
  const studentId = useUserStore((s) => s.studentId);
  const studentData = useUserStore((s) => s.studentData);
  const workspace = useWorkspaceStore((s) => s.workspace);

  const setSnapshot = useCompanionStore((s) => s.setSnapshot);
  const setBaselineEmotion = useCompanionStore((s) => s.setBaselineEmotion);
  const setGamification = useCompanionStore((s) => s.setGamification);
  const setEmotion = useCompanionStore((s) => s.setEmotion);
  const showNudge = useCompanionStore((s) => s.showNudge);
  const addMessage = useCompanionStore((s) => s.addMessage);
  const celebrate = useCompanionStore((s) => s.celebrate);

  const [summary, setSummary] = useState<DashboardEngineSummary | null>(null);
  const [minuteTick, setMinuteTick] = useState(0);
  const sessionStartRef = useRef(Date.now());

  // ── Learn: pull the dashboard engine summary (refresh as mastery changes) ──
  useEffect(() => {
    if (!studentId || !workspace?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getDashboardEngineSummary(studentId, workspace.id, 'workspace');
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null); // engine optional — degrade gracefully
      }
    };
    load();
    const t = setInterval(load, SUMMARY_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [studentId, workspace?.id, studentData]);

  // Session clock — refreshes time-based nudges (long-session break, sleep).
  useEffect(() => {
    const t = setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Distill: everything the brain needs, in one normalised snapshot ────────
  const snapshot: LearningSnapshot = useMemo(() => {
    const topics = studentData?.topics ?? {};
    const topicEntries = Object.entries(topics);

    const refOf = ([id, t]: [string, { mastery_score: number }]): ConceptRef => ({
      conceptId: id,
      name: humanizeConcept(id),
      mastery: norm01(t.mastery_score),
    });

    const weakFromTopics = topicEntries
      .filter(([, t]) => norm01(t.mastery_score) < 0.4 && t.total_attempts > 0)
      .sort((a, b) => norm01(a[1].mastery_score) - norm01(b[1].mastery_score))
      .map(refOf);

    const weakFromEngine: ConceptRef[] = (summary?.weak_areas ?? []).map((w) => ({
      conceptId: w.concept_id,
      name: humanizeConcept(w.concept_id),
      mastery: norm01(w.mastery),
      reason: w.reason,
    }));

    const strong = topicEntries
      .filter(([, t]) => norm01(t.mastery_score) >= MASTERED)
      .sort((a, b) => norm01(b[1].mastery_score) - norm01(a[1].mastery_score))
      .map(refOf);

    const totalAttempts = summary?.summary.total_attempts ?? topicEntries.reduce((n, [, t]) => n + t.total_attempts, 0);
    const correct = topicEntries.reduce((n, [, t]) => n + t.correct_answers, 0);
    const accuracy = summary?.summary.accuracy_rate != null ? norm01(summary.summary.accuracy_rate) : totalAttempts > 0 ? correct / totalAttempts : 0;

    const avgFromTopics = topicEntries.length
      ? topicEntries.reduce((n, [, t]) => n + norm01(t.mastery_score), 0) / topicEntries.length
      : 0;

    const { streak, daysSinceActive } = deriveStreak(summary?.study_heatmap ?? []);

    const now = Date.now();
    const rec = summary?.adaptive_recommendation;
    const revisionDue: ConceptRef[] = (summary?.revision_plan ?? [])
      .filter((r) => new Date(r.next_review_date).getTime() <= now)
      .slice(0, 3)
      .map((r) => ({ conceptId: r.concept_id, name: humanizeConcept(r.concept_id), reason: r.reason }));

    return {
      hasData: totalAttempts > 0 || topicEntries.length > 0 || (summary?.summary.topics_attempted ?? 0) > 0,
      studentName: authUser?.name || studentData?.name || '',
      workspaceName: workspace?.name || 'Workspace',
      averageMastery: summary?.summary.average_mastery != null ? norm01(summary.summary.average_mastery) : avgFromTopics,
      accuracy,
      totalAttempts,
      topicsStarted: summary?.summary.topics_attempted ?? topicEntries.filter(([, t]) => t.total_attempts > 0).length,
      topicsTotal: topicEntries.length,
      misconceptionCount: summary?.summary.misconception_count ?? 0,
      weakAreas: (weakFromEngine.length ? weakFromEngine : weakFromTopics).slice(0, 4),
      strongAreas: strong.slice(0, 4),
      masteredRecently: [], // filled by the celebration effect below
      recommendation: rec
        ? {
            conceptId: rec.recommended_concept ?? rec.concept_id,
            conceptName: humanizeConcept(rec.recommended_concept ?? rec.concept_name ?? ''),
            nextAction: rec.next_action,
            reason: rec.reason,
            forgettingRisk: rec.forgetting_risk,
          }
        : null,
      revisionDue,
      streakDays: streak,
      daysSinceActive,
      sessionMinutes: (Date.now() - sessionStartRef.current) / 60_000,
    };
    // minuteTick keeps sessionMinutes fresh for time-based nudges.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentData, summary, workspace?.name, authUser?.name, minuteTick]);

  // ── React: celebrations for newly-mastered concepts ───────────────────────
  useEffect(() => {
    if (!studentId || !studentData?.topics) return;
    const seen = loadSeenMastery(studentId);
    const next: Record<string, number> = { ...seen };
    const newlyMastered: ConceptRef[] = [];

    for (const [id, t] of Object.entries(studentData.topics)) {
      const m = norm01(t.mastery_score);
      if (m >= MASTERED && (seen[id] ?? 0) < MASTERED && t.total_attempts > 0) {
        newlyMastered.push({ conceptId: id, name: humanizeConcept(id), mastery: m });
      }
      next[id] = Math.max(seen[id] ?? 0, m);
    }
    saveSeenMastery(studentId, next);

    if (newlyMastered.length > 0) {
      const c = newlyMastered[0];
      celebrate();
      setEmotion('celebrating', 6000);
      const line = `Excellent! You mastered **${c.name}** 🎉 That one's locked in.`;
      const st = useCompanionStore.getState();
      if (st.isOpen) {
        addMessage(makeMessage('assistant', line, { emotion: 'celebrating' }));
      } else {
        showNudge({
          id: uid('n'),
          kind: `mastered_${c.conceptId}`,
          emotion: 'celebrating',
          text: `Excellent! You mastered ${c.name} 🎉 Ready for the next challenge?`,
          priority: 90,
          sticky: true,
        });
      }
    }
  }, [studentData, studentId, addMessage, celebrate, setEmotion, showNudge]);

  // ── Feel: publish snapshot → baseline mood, gamification, top nudge ───────
  useEffect(() => {
    setSnapshot(snapshot);
    setBaselineEmotion(deriveBaselineEmotion(snapshot));
    const masteredCount = snapshot.strongAreas.length;
    setGamification(deriveGamification(snapshot, masteredCount));

    const t = setTimeout(() => {
      const nudge = deriveNudges(snapshot)[0];
      if (nudge) showNudge(nudge);
    }, NUDGE_DELAY_MS);
    return () => clearTimeout(t);
  }, [snapshot, setSnapshot, setBaselineEmotion, setGamification, showNudge]);

  // ── Rest: doze off when the learner steps away, wake with a start ─────────
  useEffect(() => {
    let lastActivity = Date.now();
    let sleeping = false;

    const onActivity = () => {
      lastActivity = Date.now();
      if (sleeping) {
        sleeping = false;
        setEmotion('surprised', 1400); // blink awake, then settle to baseline
      }
    };

    const check = setInterval(() => {
      if (!sleeping && Date.now() - lastActivity > SLEEP_AFTER_MS) {
        sleeping = true;
        setEmotion('sleeping');
      }
    }, 10_000);

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    return () => {
      clearInterval(check);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [setEmotion]);
};
