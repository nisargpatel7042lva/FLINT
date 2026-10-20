import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  endAt,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

import { requireFirebase } from './backend';
import { pokeMessage, todayKey, type Poke, type PokeKind } from './social';
import {
  makeGroupCode,
  normaliseCode,
  normaliseHandle,
  pokeId,
  type JoinResult,
  type PublicProfile,
  type SocialRepository,
} from './socialRepository';
import type { Unsubscribe } from './repository';
import type { ClubRun } from './clubBoard';
import { cityRunId, type CityRun } from './city';
import type { CityPost } from './socialRepository';
import type { Group, GroupKind } from './types';

/**
 * Firestore-backed social layer.
 *
 * Layout:
 *
 *   profiles/{uid}                -> { name, handle, handleLower }  public
 *   handles/{handleLower}         -> { uid }                        uniqueness claim
 *   users/{uid}                   -> private; holds the FCM token
 *   users/{uid}/friends/{friendUid} -> { name, handle, addedAt }    private to owner
 *   pokes/{fromUid_toUid_kind_day} -> { fromUid, toUid, kind, ... }
 *   groups/{groupId}             -> { name, code, ownerUid, memberIds[] }
 *   groupCodes/{CODE}            -> { groupId }                    uniqueness claim
 *   groups/{groupId}/runs/{uid_ms} -> { uid, kind, distanceKm, ... } club feed
 *
 * Pokes are a top-level collection rather than a subcollection of either party
 * because both need to query them: the recipient for their inbox, the sender to
 * know what they have already spent today. Under one user's document, only one
 * of those two reads would be possible without opening up that user's whole
 * subtree.
 */

const db = () => getFirestore(requireFirebase());

const profilesCol = () => collection(db(), 'profiles');
const handlesCol = () => collection(db(), 'handles');
const pokesCol = () => collection(db(), 'pokes');
const friendsCol = (uid: string) =>
  collection(doc(collection(db(), 'users'), uid), 'friends');
const groupsCol = () => collection(db(), 'groups');
const groupRunsCol = (groupId: string) =>
  collection(doc(groupsCol(), groupId), 'runs');

/** A busy club's week fits comfortably; the feed shows far fewer. */
const CLUB_RUNS_LIMIT = 500;
const groupCodesCol = () => collection(db(), 'groupCodes');
const cityRunsCol = () => collection(db(), 'cityRuns');

/**
 * Upper bound on city runs loaded for the map.
 *
 * Two weeks of a city's runs. Plenty for a beta across a handful of clubs;
 * past that the map wants a server-side summary rather than raw runs.
 */
const CITY_RUNS_LIMIT = 2000;

/** Cell ids look like `"18530:61540"`. Anything else is ignored, not drawn. */
const CELL_ID = /^-?\d{1,6}:-?\d{1,7}$/;

const GROUPS_LIMIT = 50;
/** Draws before giving up on finding a free code. Collisions are ~1 in 10^8. */
const CODE_ATTEMPTS = 5;

const INBOX_LIMIT = 50;
const SEARCH_LIMIT = 10;

/**
 * Upper bound for a prefix range query.
 *
 * U+F8FF is a private-use character that sorts above every character a handle
 * may contain, so appending it gives the exclusive end of "starts with prefix".
 * Written as an escape rather than pasted literally: an unprintable character
 * in source survives exactly until someone's editor helpfully re-encodes it.
 */
const HIGH_SENTINEL = '\uf8ff';

/** Firestore documents are untrusted input — coerce rather than cast. */
function toProfile(uid: string, data: Record<string, unknown> | undefined): PublicProfile {
  return {
    uid,
    name: String(data?.name ?? 'Unknown'),
    handle: String(data?.handle ?? '@unknown'),
    photo: typeof data?.photo === 'string' ? data.photo : undefined,
  };
}

function toPoke(id: string, data: Record<string, unknown>): Poke {
  const kind = data.kind;
  return {
    id,
    fromId: String(data.fromUid ?? ''),
    toId: String(data.toUid ?? ''),
    kind: (kind === 'challenge' || kind === 'cheer' ? kind : 'poke') as PokeKind,
    message: String(data.message ?? ''),
    groupId: data.groupId ? String(data.groupId) : undefined,
    day: String(data.day ?? ''),
    // createdAt is a server timestamp; it is briefly null on the local echo of
    // our own write, so fall back to now rather than rendering "Invalid Date".
    createdAt:
      typeof data.createdAt === 'object' && data.createdAt !== null
        ? ((data.createdAt as { toDate?: () => Date }).toDate?.() ?? new Date()).toISOString()
        : new Date().toISOString(),
    read: Boolean(data.read),
  };
}

/**
 * A group document, as the app models it.
 *
 * The wire field is `memberIds`, the same name the app uses, because the
 * 1:1-challenge Cloud Functions write groups into this collection too and that
 * is the name they chose. One field name, one query, one set of rules.
 */
function toGroup(id: string, data: Record<string, unknown> | undefined): Group {
  const members = Array.isArray(data?.memberIds)
    ? (data?.memberIds as unknown[]).map(String)
    : [];
  return {
    id,
    name: String(data?.name ?? 'Group'),
    kind: data?.kind === 'club' ? 'club' : 'squad',
    code: String(data?.code ?? ''),
    ownerUid: String(data?.ownerUid ?? ''),
    memberIds: members,
    // Same server-timestamp caveat as `toPoke`, and the same fallback. A group
    // is keyed on its day only for ordering, so "now" is the honest guess.
    createdAt: toDay(data?.createdAt),
  };
}

/** `YYYY-MM-DD` in local time, matching every other day key in the app. */
function toDay(value: unknown): string {
  const d =
    typeof value === 'object' && value !== null
      ? ((value as { toDate?: () => Date }).toDate?.() ?? new Date())
      : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function toCityRun(id: string, data: Record<string, unknown>): CityRun {
  const created = data.createdAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    clubId: String(data.clubId ?? ''),
    clubName: String(data.clubName ?? 'A club'),
    cells: Array.isArray(data.cells)
      ? data.cells.filter((c): c is string => typeof c === 'string' && CELL_ID.test(c))
      : [],
    // A pending server timestamp reads as null until it lands: treat it as now.
    createdAtMs: created?.toMillis?.() ?? Date.now(),
  };
}

function toClubRun(id: string, data: Record<string, unknown>): ClubRun {
  const created = data.createdAt as { toDate?: () => Date } | null | undefined;
  return {
    id,
    uid: String(data.uid ?? ''),
    kind: data.kind === 'walk' ? 'walk' : 'run',
    distanceKm: Number(data.distanceKm ?? 0),
    durationSec: Number(data.durationSec ?? 0),
    day: String(data.day ?? ''),
    // Null on the local echo of our own write; "now" is the honest stand-in.
    createdAt: (created?.toDate?.() ?? new Date()).toISOString(),
  };
}

/**
 * A write the rules refused, as opposed to one that failed.
 *
 * Both group creation and joining lean on this: a denied write there means
 * "somebody already holds that" or "you are not a member yet", which are
 * expected states with their own handling. Treating a network failure as one of
 * those would silently take the wrong branch.
 */
const isPermissionDenied = (e: unknown): boolean =>
  String((e as { code?: string })?.code ?? '').includes('permission-denied');

export class FirestoreSocialRepository implements SocialRepository {
  readonly kind = 'firestore' as const;

  async ensureProfile(
    uid: string,
    name: string,
    handle: string,
  ): Promise<PublicProfile> {
    const handleLower = normaliseHandle(handle);
    const claimRef = doc(handlesCol(), handleLower);
    const claim = await getDoc(claimRef);

    if (claim.exists() && claim.data()?.uid !== uid) {
      throw new Error(`@${handleLower} is already taken.`);
    }

    const profile: PublicProfile = { uid, name: name.trim(), handle: `@${handleLower}` };

    // The claim is created first. If the profile write then fails the handle is
    // held by its rightful owner and the next attempt succeeds; the reverse
    // order could publish a profile whose handle somebody else can still take.
    if (!claim.exists()) {
      await setDoc(claimRef, { uid, createdAt: serverTimestamp() });
    }
    await setDoc(
      doc(profilesCol(), uid),
      { name: profile.name, handle: profile.handle, handleLower },
      { merge: true },
    );

    return profile;
  }

  async getProfile(uid: string): Promise<PublicProfile | null> {
    const snap = await getDoc(doc(profilesCol(), uid));
    return snap.exists() ? toProfile(uid, snap.data()) : null;
  }

  async setPhoto(uid: string, photo: string | null): Promise<void> {
    // Merge onto the existing profile: the rules check the whole result, and
    // name and handle must still be there.
    await setDoc(
      doc(profilesCol(), uid),
      { photo: photo ?? deleteField() },
      { merge: true },
    );
  }

  async searchProfiles(term: string, excludeUid: string): Promise<PublicProfile[]> {
    const prefix = normaliseHandle(term);
    if (prefix.length < 2) {
      return [];
    }

    /*
     * Prefix search as a range query: [prefix, prefix + sentinel] spans exactly
     * the handles beginning with `prefix`. Firestore has no LIKE, and pulling
     * the collection down to filter on the client would be both slow and a way
     * for anyone to enumerate every user on the platform.
     */
    const snap = await getDocs(
      query(
        profilesCol(),
        orderBy('handleLower'),
        startAt(prefix),
        endAt(`${prefix}${HIGH_SENTINEL}`),
        limit(SEARCH_LIMIT),
      ),
    );

    return snap.docs
      .map(d => toProfile(d.id, d.data()))
      .filter(p => p.uid !== excludeUid);
  }

  watchFriends(uid: string, onChange: (friends: PublicProfile[]) => void): Unsubscribe {
    return onSnapshot(
      query(friendsCol(uid), orderBy('name')),
      snap => onChange(snap.docs.map(d => toProfile(d.id, d.data()))),
      () => onChange([]),
    );
  }

  async addFriend(uid: string, friend: PublicProfile): Promise<void> {
    await setDoc(doc(friendsCol(uid), friend.uid), {
      name: friend.name,
      handle: friend.handle,
      addedAt: serverTimestamp(),
    });
  }

  async removeFriend(uid: string, friendUid: string): Promise<void> {
    await deleteDoc(doc(friendsCol(uid), friendUid));
  }

  watchInbox(uid: string, onChange: (pokes: Poke[]) => void): Unsubscribe {
    return onSnapshot(
      query(
        pokesCol(),
        where('toUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(INBOX_LIMIT),
      ),
      snap => onChange(snap.docs.map(d => toPoke(d.id, d.data()))),
      () => onChange([]),
    );
  }

  watchSent(uid: string, onChange: (pokes: Poke[]) => void): Unsubscribe {
    return onSnapshot(
      query(
        pokesCol(),
        where('fromUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(INBOX_LIMIT),
      ),
      snap => onChange(snap.docs.map(d => toPoke(d.id, d.data()))),
      () => onChange([]),
    );
  }

  async sendPoke(
    fromUid: string,
    to: PublicProfile,
    kind: PokeKind,
    groupId?: string,
  ): Promise<Poke | null> {
    const day = todayKey();
    const id = pokeId(fromUid, to.uid, kind, day);
    const ref = doc(pokesCol(), id);

    const payload = {
      fromUid,
      toUid: to.uid,
      kind,
      message: pokeMessage(kind, Date.now()),
      day,
      createdAt: serverTimestamp(),
      read: false,
      ...(groupId ? { groupId } : {}),
    };

    try {
      // No merge: a second nudge of the same kind today must collide, not
      // overwrite. Writing to an id that already exists is an UPDATE as far as
      // the rules are concerned, and only the recipient may update (and only
      // the `read` field) — so the second send is refused by the server rather
      // than by this client.
      await setDoc(ref, payload);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code.includes('permission-denied')) {
        return null; // today's is spent
      }
      // Anything else — offline, quota, a bad rule — is a real failure, and
      // reporting it as "already nudged" would be a lie the user acts on.
      throw e;
    }

    return toPoke(id, { ...payload, createdAt: null });
  }

  // ── Groups ───────────────────────────────────────────────────────────────

  watchGroups(uid: string, onChange: (groups: Group[]) => void): Unsubscribe {
    /*
     * `array-contains` on the member list is what makes the read rule
     * enforceable. The rule says "readable only if you are in memberIds", and
     * Firestore accepts a query only when every document it could return is
     * provably allowed — which this one is, and a plain `orderBy` alone would
     * not be.
     */
    const q = query(
      groupsCol(),
      where('memberIds', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
      limit(GROUPS_LIMIT),
    );
    return onSnapshot(
      q,
      snap => onChange(snap.docs.map(d => toGroup(d.id, d.data()))),
      () => onChange([]),
    );
  }

  async createGroup(uid: string, name: string, kind: GroupKind = 'squad'): Promise<Group> {
    const id = doc(groupsCol()).id;

    /*
     * The code is claimed BEFORE the group exists.
     *
     * `groupCodes/{CODE}` may be created but never updated, so a second person
     * drawing the same code at the same moment is rejected by the rules rather
     * than by a check that raced. Losing the draw costs one retry.
     *
     * The failure mode is a reserved code with no group behind it, which is
     * inert: joining resolves the code, finds nothing, and reports an unknown
     * code exactly as it would for a typo.
     */
    let code = '';
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const candidate = makeGroupCode();
      try {
        await setDoc(doc(groupCodesCol(), candidate), { groupId: id });
        code = candidate;
        break;
      } catch (e) {
        if (!isPermissionDenied(e)) {
          throw e;
        }
      }
    }
    if (!code) {
      throw new Error('Could not reserve a join code. Try again.');
    }

    const payload = {
      name: name.trim(),
      kind,
      code,
      ownerUid: uid,
      memberIds: [uid],
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(groupsCol(), id), payload);

    return toGroup(id, { ...payload, createdAt: null });
  }

  async joinGroup(uid: string, rawCode: string): Promise<JoinResult> {
    const code = normaliseCode(rawCode);
    if (!code) {
      return { state: 'unknown' };
    }

    const claim = await getDoc(doc(groupCodesCol(), code));
    const groupId = claim.exists() ? (claim.data()?.groupId as string) : null;
    if (!groupId) {
      return { state: 'unknown' };
    }

    const ref = doc(groupsCol(), groupId);

    /*
     * Reading first is how "already a member" is detected.
     *
     * The read rule only passes for members, so a successful read IS the
     * membership check — no separate query, and no window where the client's
     * idea of the member list disagrees with the server's.
     */
    try {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        return { state: 'already', group: toGroup(existing.id, existing.data()) };
      }
      // A reserved code whose group was never written. Same outcome as a typo.
      return { state: 'unknown' };
    } catch (e) {
      if (!isPermissionDenied(e)) {
        throw e;
      }
    }

    // Not a member yet. The rules allow adding exactly one uid — your own.
    await updateDoc(ref, { memberIds: arrayUnion(uid) });
    const joined = await getDoc(ref);
    if (!joined.exists()) {
      return { state: 'unknown' };
    }
    return { state: 'joined', group: toGroup(joined.id, joined.data()) };
  }

  async leaveGroup(uid: string, groupId: string): Promise<void> {
    await updateDoc(doc(groupsCol(), groupId), { memberIds: arrayRemove(uid) });
  }

  async addToGroup(_uid: string, groupId: string, memberUid: string): Promise<void> {
    await updateDoc(doc(groupsCol(), groupId), {
      memberIds: arrayUnion(memberUid),
    });
  }

  async removeFromGroup(
    _uid: string,
    groupId: string,
    memberUid: string,
  ): Promise<void> {
    await updateDoc(doc(groupsCol(), groupId), {
      memberIds: arrayRemove(memberUid),
    });
  }

  async postRun(
    uid: string,
    run: ClubRun,
    groupIds: string[],
    city?: CityPost,
  ): Promise<void> {
    if (groupIds.length === 0) {
      return;
    }
    /*
     * One batch, so a run lands in every club or in none — a run that shows
     * on one club's board and not another's is the kind of inconsistency
     * people notice and argue about.
     */
    const batch = writeBatch(db());
    groupIds.slice(0, 20).forEach(gid => {
      batch.set(doc(groupRunsCol(gid), run.id), {
        uid,
        kind: run.kind,
        distanceKm: run.distanceKm,
        durationSec: run.durationSec,
        day: run.day,
        createdAt: serverTimestamp(),
      });
    });
    if (city && city.cells.length > 0) {
      // The club run's id is `${uid}_${startedAtMs}`; the rules find it again
      // from request.auth plus this number.
      const runMs = Number(run.id.slice(run.id.lastIndexOf('_') + 1));
      city.clubs
        .filter(c => groupIds.includes(c.id))
        .slice(0, 20)
        .forEach(c => {
          // No uid anywhere in a city run — the id is a one-way hash, and the
          // rules check it against request.auth instead.
          batch.set(doc(cityRunsCol(), cityRunId(uid, runMs, c.id)), {
            clubId: c.id,
            clubName: c.name,
            cells: city.cells,
            region: city.region,
            runMs,
            createdAt: serverTimestamp(),
          });
        });
    }
    await batch.commit();
  }

  watchCity(
    regions: string[],
    sinceMs: number,
    onChange: (runs: CityRun[]) => void,
  ): Unsubscribe {
    if (regions.length === 0) {
      onChange([]);
      return () => {};
    }
    const q = query(
      cityRunsCol(),
      where('region', 'in', regions.slice(0, 30)),
      where('createdAt', '>=', new Date(sinceMs)),
      orderBy('createdAt', 'asc'),
      limit(CITY_RUNS_LIMIT),
    );
    return onSnapshot(
      q,
      snap => onChange(snap.docs.map(d => toCityRun(d.id, d.data()))),
      () => onChange([]),
    );
  }

  watchGroupRuns(
    groupId: string,
    sinceDay: string,
    onChange: (runs: ClubRun[]) => void,
  ): Unsubscribe {
    // `day` is both the filter and the order, so the automatic single-field
    // index serves it and no composite index has to be deployed.
    const q = query(
      groupRunsCol(groupId),
      where('day', '>=', sinceDay),
      orderBy('day', 'desc'),
      limit(CLUB_RUNS_LIMIT),
    );
    return onSnapshot(
      q,
      snap =>
        onChange(
          snap.docs
            .map(d => toClubRun(d.id, d.data()))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      () => onChange([]),
    );
  }

  async markInboxRead(uid: string, pokeIds: string[]): Promise<void> {
    if (pokeIds.length === 0) {
      return;
    }
    const batch = writeBatch(db());
    pokeIds.slice(0, 400).forEach(id => {
      batch.update(doc(pokesCol(), id), { read: true });
    });
    await batch.commit();
  }
}
