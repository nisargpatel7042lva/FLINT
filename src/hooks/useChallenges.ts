/**
 * React hooks for 1:1 challenges.
 * 
 * Provides live data subscriptions following the same pattern as useSessions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ensureSignedIn, currentUser } from '../services/auth';
import type {
  OneOnOneChallenge,
  ChallengeStreak,
  Submission,
  ActivityKind,
  Effort,
} from '../services/types';
import {
  createOneOnOneChallenge,
  getChallenge,
  getChallengeByToken,
  acceptChallenge,
  logChallengeActivity,
  getChallengeSubmissions,
  getChallengeStreak,
  watchUserChallenges,
} from '../services/repository.challenges';
import { buildRematch, getLocalDay } from '../services/challenges';

/**
 * Hook for loading a single challenge by ID.
 */
export function useChallenge(challengeId: string) {
  const [challenge, setChallenge] = useState<OneOnOneChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getChallenge(challengeId);
        if (!cancelled) {
          setChallenge(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  return { challenge, loading, error };
}

/**
 * Hook for loading a challenge by invite token.
 */
export function useChallengeByToken(token: string) {
  const [challenge, setChallenge] = useState<OneOnOneChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getChallengeByToken(token);
        if (!cancelled) {
          setChallenge(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { challenge, loading, error };
}

/**
 * Hook for loading challenge submissions (activity logs).
 */
export function useChallengeSubmissions(challengeId: string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getChallengeSubmissions(challengeId);
      setSubmissions(data);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { submissions, loading, error, reload };
}

/**
 * Hook for loading challenge streak for a user.
 */
export function useChallengeStreakForUser(challengeId: string, userId: string) {
  const [streak, setStreak] = useState<ChallengeStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getChallengeStreak(challengeId, userId);
      setStreak(data);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [challengeId, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { streak, loading, error, reload };
}

/**
 * Hook for loading both user and opponent streaks for a challenge.
 */
export function useChallengeStreaks(challenge: OneOnOneChallenge | null) {
  const user = currentUser();
  const userId = user?.uid ?? '';
  const opponentId = challenge?.opponentId ?? '';

  const {
    streak: myStreak,
    loading: myLoading,
    error: myError,
    reload: reloadMyStreak,
  } = useChallengeStreakForUser(challenge?.id ?? '', userId);

  const {
    streak: opponentStreak,
    loading: opponentLoading,
    error: opponentError,
    reload: reloadOpponentStreak,
  } = useChallengeStreakForUser(challenge?.id ?? '', opponentId);

  const reload = useCallback(() => {
    reloadMyStreak();
    if (opponentId) {
      reloadOpponentStreak();
    }
  }, [reloadMyStreak, reloadOpponentStreak, opponentId]);

  return {
    myStreak,
    opponentStreak: opponentId ? opponentStreak : null,
    loading: myLoading || (opponentId && opponentLoading),
    error: myError || opponentError,
    reload,
  };
}

/**
 * Hook for creating a new challenge.
 */
export function useCreateChallenge() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (activityKind: ActivityKind, targetDays: number, title?: string) => {
      try {
        setCreating(true);
        setError(null);
        const user = await ensureSignedIn();
        const challenge = await createOneOnOneChallenge(
          user.uid,
          activityKind,
          targetDays,
          title,
        );
        setCreating(false);
        return challenge;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setCreating(false);
        throw e;
      }
    },
    [],
  );

  return { create, creating, error };
}

/**
 * Hook for accepting a challenge.
 */
export function useAcceptChallenge() {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(async (challengeId: string) => {
    try {
      setAccepting(true);
      setError(null);
      const user = await ensureSignedIn();
      const result = await acceptChallenge(challengeId, user.uid);
      setAccepting(false);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAccepting(false);
      throw e;
    }
  }, []);

  return { accept, accepting, error };
}

/**
 * Hook for logging challenge activity.
 */
export function useLogChallengeActivity() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logActivity = useCallback(
    async (
      challengeId: string,
      activityKind: ActivityKind,
      effort: Effort,
      note?: string,
    ) => {
      try {
        setSubmitting(true);
        setError(null);
        const user = await ensureSignedIn();
        const submission = await logChallengeActivity(
          challengeId,
          user.uid,
          activityKind,
          effort,
          note,
        );
        setSubmitting(false);
        return submission;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSubmitting(false);
        throw e;
      }
    },
    [],
  );

  return { logActivity, submitting, error };
}

/**
 * Hook for creating a rematch challenge.
 */
export function useRematchChallenge() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rematch = useCallback(async (original: OneOnOneChallenge) => {
    try {
      setCreating(true);
      setError(null);
      const user = await ensureSignedIn();
      
      if (!original.opponentId) {
        throw new Error('Cannot rematch a challenge without an opponent');
      }

      // Build rematch with increased difficulty
      const rematchData = buildRematch(original, user.uid, original.opponentId);
      
      // Create the new challenge (already active since both users are known)
      const challenge = await createOneOnOneChallenge(
        user.uid,
        rematchData.activityKind,
        rematchData.targetDays,
        rematchData.title,
      );

      // Accept it immediately as the opponent
      const result = await acceptChallenge(challenge.id, original.opponentId);
      
      setCreating(false);
      return result.challenge;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCreating(false);
      throw e;
    }
  }, []);

  return { rematch, creating, error };
}
