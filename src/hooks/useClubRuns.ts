import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  passedBy,
  rankOf,
  aboveOf,
  weekStartKey,
  weeklyBoard,
  type BoardEntry,
  type ClubRun,
} from '../services/clubBoard';
import { getSocialRepository } from '../services/socialRepositoryProvider';
import { TRAINING_TODAY } from '../services/trainingData';

export type ClubRunsState = {
  runs: ClubRun[];
  board: BoardEntry[];
  /** 1-based, or null when this person has not run this week. */
  myRank: number | null;
  /** People who overtook this person since they last opened the club. */
  passers: BoardEntry[];
  /** Records the current board as seen, so the same pass is not reported twice. */
  acknowledge: () => void;
  loading: boolean;
};

const seenKey = (groupId: string) => `flint.board.seen.${groupId}`;

type Seen = { week: string; above: string[] };

/**
 * A club's week, live: its runs, the distance board, and who just passed you.
 *
 * "Passed you" is computed against what this person saw last time, stored per
 * club. That is deliberately not "since the last run": the banner is about the
 * moment you open the club and find somebody where you were. The record resets
 * with the week, so Monday's empty board does not read as everyone passing.
 */
export function useClubRuns(groupId: string, uid: string): ClubRunsState {
  const repo = useMemo(() => getSocialRepository(), []);
  const weekStart = weekStartKey(TRAINING_TODAY);

  const [runs, setRuns] = useState<ClubRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState<Seen | null>(null);
  // State, not a ref: the baseline effect below has to re-run when this flips.
  const [seenReady, setSeenReady] = useState(false);

  useEffect(() => {
    // No club yet (Home before joining one): nothing to watch, and an empty
    // id would be an invalid Firestore path.
    if (!groupId) {
      setRuns([]);
      setLoading(false);
      return;
    }
    const unsub = repo.watchGroupRuns(groupId, weekStart, next => {
      setRuns(next);
      setLoading(false);
    });
    return unsub;
  }, [repo, groupId, weekStart]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(seenKey(groupId))
      .then(raw => {
        if (!alive) {
          return;
        }
        const parsed = raw ? (JSON.parse(raw) as Seen) : null;
        setSeen(parsed && parsed.week === weekStart ? parsed : null);
        setSeenReady(true);
      })
      .catch(() => setSeenReady(true));
    return () => {
      alive = false;
    };
  }, [groupId, weekStart]);

  const board = useMemo(() => weeklyBoard(runs, weekStart), [runs, weekStart]);
  const myRank = uid ? rankOf(board, uid) : null;

  /*
   * No baseline yet means no banner. The first time somebody opens a club
   * this week there is nothing to have been passed SINCE — announcing the
   * whole board as overtakers would be noise dressed up as news.
   */
  const passers = useMemo(
    () => (uid && seen ? passedBy(board, uid, seen.above) : []),
    [board, uid, seen],
  );

  const acknowledge = useCallback(() => {
    if (!uid) {
      return;
    }
    const next: Seen = { week: weekStart, above: aboveOf(board, uid) };
    setSeen(next);
    AsyncStorage.setItem(seenKey(groupId), JSON.stringify(next)).catch(() => {});
  }, [board, uid, weekStart, groupId]);

  // Establish the baseline silently the first time this club is opened.
  useEffect(() => {
    if (!loading && seenReady && seen === null && uid && myRank !== null) {
      acknowledge();
    }
  }, [loading, seenReady, seen, uid, myRank, acknowledge]);

  return { runs, board, myRank, passers, acknowledge, loading };
}
