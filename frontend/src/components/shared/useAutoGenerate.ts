/**
 * useAutoGenerate — the shared "deep link into a generator" effect.
 *
 * A dashboard/chat action hands the Generate page a one-shot request
 * ({ id, conceptId }). The consumer must (1) retarget its topic to the
 * requested concept first, then (2) run the generator on the next effect pass
 * once the topic has settled — and never re-run for a key it already consumed.
 * That two-pass dance was copy-pasted verbatim in three pages; it lives here
 * now.
 */
import { useEffect, useRef } from 'react';

export function useAutoGenerate(opts: {
  autoGenerateKey?: number;
  autoConceptId?: string | null;
  topic: string;
  /** Must also sync any global selection the caller keeps (selectedNodeId). */
  setTopic: (conceptId: string) => void;
  /** Everything required to run right now (workspace ready, not loading…). */
  ready: boolean;
  onConsumed?: () => void;
  run: () => void;
}): void {
  const { autoGenerateKey, autoConceptId, topic, setTopic, ready, onConsumed, run } = opts;
  const consumedKey = useRef<number | null>(null);

  useEffect(() => {
    if (!autoGenerateKey || consumedKey.current === autoGenerateKey) return;
    if (!ready) return;
    if (autoConceptId && autoConceptId !== topic) {
      setTopic(autoConceptId);
      return; // run on the next effect pass, once the topic has settled
    }
    consumedKey.current = autoGenerateKey;
    onConsumed?.();
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateKey, autoConceptId, topic, ready]);
}

export default useAutoGenerate;
