import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ensureSignedIn } from '../services/auth';
import { socialStore, todayKey, type Poke, type PokeKind } from '../services/social';
import { getSocialRepository } from '../services/socialRepositoryProvider';
import type { JoinResult, PublicProfile } from '../services/socialRepository';
import type { ClubRun } from '../services/clubBoard';
import type { Group, GroupKind } from '../services/types';
import { runId } from '../services/runs';

/** A finished run before it has a poster: the id is derived from their uid. */
export type ClubRunDraft = Omit<ClubRun, 'id' | 'uid' | 'createdAt'> & {
  startedAtMs: number;
};

export type SocialApi = {
  /** False until identity and the first snapshots have resolved. */
  loading: boolean;
  /** Which backend is live — surfaced in the UI so it is never a mystery. */
  source: 'firestore' | 'local';
  /** The signed-in user's id. Empty until resolved. */
  uid: string;

  friends: PublicProfile[];
  /** Nudges addressed to me, newest first. */
  received: Poke[];
  /** Nudges I sent — what the daily cap is read from. */
  sent: Poke[];
  unreadPokes: number;

  /** Groups this user belongs to, newest first. */
  groups: Group[];
  groupById: (id: string) => Group | undefined;

  createGroup: (name: string, kind?: GroupKind) => Promise<Group>;
  /** Posts a finished run to every group this person is in. */
  postRun: (run: ClubRunDraft) => Promise<number>;
  /** Resolves what happened, so "already in that group" is not shown as an error. */
  joinGroup: (code: string) => Promise<JoinResult>;
  leaveGroup: (groupId: string) => Promise<void>;
  addToGroup: (groupId: string, memberUid: string) => Promise<void>;
  removeFromGroup: (groupId: string, memberUid: string) => Promise<void>;

  /**
   * Claims a handle and publishes the public profile.
   *
   * Rejects if the handle is taken — that is the point of it being unique, and
   * the caller is expected to surface the failure rather than swallow it.
   */
  claimProfile: (name: string, handle: string) => Promise<PublicProfile>;
  searchProfiles: (term: string) => Promise<PublicProfile[]>;
  addFriend: (friend: PublicProfile) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  /** Resolves false when today's nudge of that kind was already spent. */
  sendPoke: (to: PublicProfile, kind: PokeKind, groupId?: string) => Promise<boolean>;
  markInboxRead: () => Promise<void>;
  /** True when today's nudge of that kind has already gone to that person. */
  spent: (toUid: string, kind: PokeKind) => boolean;
  /** Display name for a uid, resolving in the background if it is a stranger. */
  nameFor: (uid: string) => string;
};

/**
 * The single read path for the social layer, mirroring `useSessions`.
 *
 * Everything here goes through `SocialRepository`, so the same screens drive
 * real accounts when Firebase is configured and the fixture cast when it is
 * not — no screen branches on which. Groups included: they were the last thing
 * reading the device-local store directly, and a squad that existed only on the
 * phone that made it was a squad in name only.
 */
export function useSocial(): SocialApi {
  const repo = useMemo(() => getSocialRepository(), []);

  const [uid, setUid] = useState('');
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [received, setReceived] = useState<Poke[]>([]);
  const [sent, setSent] = useState<Poke[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  /*
   * Names for people who are not (yet) friends.
   *
   * A nudge carries only the sender's uid. The name is fetched from their
   * public profile rather than being denormalised onto the nudge, because a
   * name written by the sending client is a name the sending client chose —
   * fine for a push (the server looks it up itself) but not for the in-app
   * list, where it would be a free impersonation slot.
   */
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});

  const uidRef = useRef('');

  useEffect(() => {
    let alive = true;
    const unsubs: (() => void)[] = [];

    (async () => {
      const user = await ensureSignedIn();
      if (!alive) {
        return;
      }
      uidRef.current = user.uid;
      setUid(user.uid);

      unsubs.push(repo.watchFriends(user.uid, next => alive && setFriends(next)));
      unsubs.push(repo.watchGroups(user.uid, next => alive && setGroups(next)));
      unsubs.push(repo.watchInbox(user.uid, next => alive && setReceived(next)));
      unsubs.push(repo.watchSent(user.uid, next => alive && setSent(next)));
      setLoading(false);
    })();

    /*
     * The local repository reads groups straight out of this store, so it has
     * to be loaded before its first snapshot means anything. Harmless against
     * Firestore, where nothing subscribes to it.
     */
    socialStore.hydrate();

    return () => {
      alive = false;
      unsubs.forEach(u => u());
    };
  }, [repo]);

  const today = todayKey();

  const spent = useCallback(
    (toUid: string, kind: PokeKind) =>
      sent.some(p => p.toId === toUid && p.kind === kind && p.day === today),
    [sent, today],
  );

  const claimProfile = useCallback(
    async (name: string, handle: string) => {
      const uidNow = uidRef.current || (await ensureSignedIn()).uid;
      return repo.ensureProfile(uidNow, name, handle);
    },
    [repo],
  );

  const searchProfiles = useCallback(
    (term: string) => repo.searchProfiles(term, uidRef.current),
    [repo],
  );

  const addFriend = useCallback(
    (friend: PublicProfile) => repo.addFriend(uidRef.current, friend),
    [repo],
  );

  const removeFriend = useCallback(
    (friendUid: string) => repo.removeFriend(uidRef.current, friendUid),
    [repo],
  );

  const sendPoke = useCallback(
    async (to: PublicProfile, kind: PokeKind, groupId?: string) => {
      try {
        const poke = await repo.sendPoke(uidRef.current, to, kind, groupId);
        return poke !== null;
      } catch {
        // A genuine failure (offline, rules) rather than the daily cap. The
        // button stays available, which is the honest outcome: nothing was
        // sent, so trying again should be allowed.
        return false;
      }
    },
    [repo],
  );

  const markInboxRead = useCallback(
    () =>
      repo.markInboxRead(
        uidRef.current,
        received.filter(p => !p.read).map(p => p.id),
      ),
    [repo, received],
  );

  /** uids we have already asked about, so a miss is not re-fetched every render. */
  const requested = useRef<Set<string>>(new Set());

  const nameFor = useCallback(
    (id: string) => {
      const friend = friends.find(f => f.uid === id);
      if (friend) {
        return friend.name;
      }
      const cached = profiles[id];
      if (cached) {
        return cached.name;
      }
      if (id && !requested.current.has(id)) {
        requested.current.add(id);
        repo
          .getProfile(id)
          .then(p => p && setProfiles(prev => ({ ...prev, [id]: p })))
          .catch(() => {});
      }
      return 'Someone';
    },
    [friends, profiles, repo],
  );

  const createGroup = useCallback(
    async (name: string, kind?: GroupKind) => {
      const uidNow = uidRef.current || (await ensureSignedIn()).uid;
      return repo.createGroup(uidNow, name, kind);
    },
    [repo],
  );

  /*
   * Resolves to how many groups the run went to, so the finish screen can say
   * "Posted to Sunrise Runners" instead of implying an audience that is not
   * there.
   */
  const postRun = useCallback(
    async ({ startedAtMs, ...run }: ClubRunDraft) => {
      const uidNow = uidRef.current || (await ensureSignedIn()).uid;
      const ids = groups.map(g => g.id);
      if (ids.length === 0) {
        return 0;
      }
      await repo.postRun(
        uidNow,
        {
          ...run,
          id: runId(uidNow, startedAtMs),
          uid: uidNow,
          createdAt: new Date().toISOString(),
        },
        ids,
      );
      return ids.length;
    },
    [repo, groups],
  );

  const joinGroup = useCallback(
    async (code: string): Promise<JoinResult> => {
      const uidNow = uidRef.current || (await ensureSignedIn()).uid;
      return repo.joinGroup(uidNow, code);
    },
    [repo],
  );

  const leaveGroup = useCallback(
    (groupId: string) => repo.leaveGroup(uidRef.current, groupId),
    [repo],
  );

  const addToGroup = useCallback(
    (groupId: string, memberUid: string) =>
      repo.addToGroup(uidRef.current, groupId, memberUid),
    [repo],
  );

  const removeFromGroup = useCallback(
    (groupId: string, memberUid: string) =>
      repo.removeFromGroup(uidRef.current, groupId, memberUid),
    [repo],
  );

  const groupById = useCallback(
    (id: string) => groups.find(g => g.id === id),
    [groups],
  );

  return {
    loading,
    source: repo.kind,
    uid,
    friends,
    received,
    sent,
    unreadPokes: received.filter(p => !p.read).length,
    groups,
    groupById,
    createGroup,
    postRun,
    joinGroup,
    leaveGroup,
    addToGroup,
    removeFromGroup,
    claimProfile,
    searchProfiles,
    addFriend,
    removeFriend,
    sendPoke,
    markInboxRead,
    spent,
    nameFor,
  };
}
