import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ensureSignedIn } from '../services/auth';
import { getRepository } from '../services/repositoryProvider';
import {
  computeStats,
  currentStreak,
  longestStreak,
  streakAtRisk,
  type SessionLog,
  type Stats,
} from '../services/training';
import { TRAINING_TODAY } from '../services/trainingData';

export type SessionsState = {
  logs: SessionLog[];
  loading: boolean;
  error: string | null;
  /** Which backend the data came from — surfaced so it is never a mystery. */
  source: 'firestore' | 'local';

  streak: number;
  best: number;
  atRisk: boolean;
  stats: Stats;

  addSession: (log: Omit<SessionLog, 'id'>) => Promise<void>;
};

/**
 * The single read path for training data.
 *
 * Subscribes to the repository, so a Firestore write from anywhere (including
 * a Cloud Function) reflects live, and derives every streak/stat figure from
 * one list — screens can no longer disagree about the streak because they each
 * computed it from a different source.
 */
export function useSessions(): SessionsState {
  const repo = useMemo(() => getRepository(), []);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const user = await ensureSignedIn();
        if (cancelled) {
          return;
        }
        uidRef.current = user.uid;

        unsub = repo.watchSessions(
          user.uid,
          next => {
            setLogs(next);
            setLoading(false);
          },
          e => {
            setError(e.message);
            setLoading(false);
          },
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [repo]);

  const addSession = useCallback(
    async (log: Omit<SessionLog, 'id'>) => {
      const uid = uidRef.current ?? (await ensureSignedIn()).uid;
      await repo.addSession(uid, log);
    },
    [repo],
  );

  const streak = useMemo(() => currentStreak(logs, TRAINING_TODAY), [logs]);
  const best = useMemo(() => longestStreak(logs), [logs]);
  const atRisk = useMemo(() => streakAtRisk(logs, TRAINING_TODAY), [logs]);
  const stats = useMemo(() => computeStats(logs, TRAINING_TODAY), [logs]);

  return {
    logs,
    loading,
    error,
    source: repo.kind,
    streak,
    best,
    atRisk,
    stats,
    addSession,
  };
}
