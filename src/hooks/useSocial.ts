import { useCallback, useEffect, useMemo, useState } from 'react';

import { CURRENT_USER_ID, memberById } from '../services/mockData';
import { socialStore, suggestedMembers, type SocialState } from '../services/social';
import type { Group, Member } from '../services/types';

export type SocialApi = SocialState & {
  /** False until persisted state has been read. */
  loading: boolean;
  friends: Member[];
  suggestions: Member[];
  /** Nudges pointed at the current user. */
  received: import('../services/social').Poke[];
  unreadPokes: number;
  groupById: (id: string) => Group | undefined;
};

/**
 * The single read path for the social layer, mirroring `useSessions`.
 *
 * Every screen subscribes to the same store, so joining a group on one screen
 * is visible on another without either of them knowing the other exists.
 */
export function useSocial(): SocialApi {
  const [state, setState] = useState<SocialState>(() => socialStore.getState());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const unsub = socialStore.subscribe(next => {
      if (alive) {
        setState(next);
      }
    });
    socialStore.hydrate().then(() => {
      if (alive) {
        setLoading(false);
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const friends = useMemo(
    () => state.friendIds.map(memberById).filter(Boolean),
    [state.friendIds],
  );

  const suggestions = useMemo(
    () => suggestedMembers(state.friendIds),
    [state.friendIds],
  );

  const received = useMemo(
    () => state.pokes.filter(n => n.toId === CURRENT_USER_ID),
    [state.pokes],
  );

  const groupById = useCallback(
    (id: string) => state.groups.find(g => g.id === id),
    [state.groups],
  );

  return {
    ...state,
    loading,
    friends,
    suggestions,
    received,
    unreadPokes: received.filter(n => !n.read).length,
    groupById,
  };
}
