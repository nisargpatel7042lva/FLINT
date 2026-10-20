import { CODE_ALPHABET, type Poke, type PokeKind } from './social';
import type { Unsubscribe } from './repository';
import type { ClubRun } from './clubBoard';
import type { CityRun } from './city';
import type { Group, GroupKind } from './types';

/**
 * The data boundary for the social layer.
 *
 * Mirrors `TrainingRepository`: screens depend on this interface, never on
 * Firestore or on the fixtures, so the same Friends screen drives real accounts
 * when Firebase is configured and seeded people when it is not.
 *
 * The distinction that matters here is between a PUBLIC profile and a private
 * user document. A nudge needs to know a stranger's display name and handle, so
 * those are readable by any signed-in user; the FCM token that makes the phone
 * buzz is not, and lives on the private document where only Cloud Functions
 * reach it. Conflating the two is how a social feature becomes a way to harvest
 * push tokens.
 */

/** The parts of a person that anyone signed in may see. */
export type PublicProfile = {
  uid: string;
  name: string;
  handle: string;
  /** A small JPEG as a data URL, when the person has set one. */
  photo?: string;
};

export interface SocialRepository {
  /** Which implementation is live — surfaced in the UI so it is never a mystery. */
  readonly kind: 'firestore' | 'local';

  /**
   * Claims `handle` for this user and publishes their public profile.
   *
   * Throws if the handle is already taken. Uniqueness is structural: the claim
   * is a document whose id IS the handle, so two people cannot hold one.
   */
  ensureProfile(uid: string, name: string, handle: string): Promise<PublicProfile>;

  getProfile(uid: string): Promise<PublicProfile | null>;

  /** Sets (or, with null, removes) the signed-in person's profile photo. */
  setPhoto(uid: string, photo: string | null): Promise<void>;

  /** Prefix search over handles. Returns at most a handful. */
  searchProfiles(term: string, excludeUid: string): Promise<PublicProfile[]>;

  watchFriends(uid: string, onChange: (friends: PublicProfile[]) => void): Unsubscribe;
  addFriend(uid: string, friend: PublicProfile): Promise<void>;
  removeFriend(uid: string, friendUid: string): Promise<void>;

  /** Nudges addressed to me, newest first. */
  watchInbox(uid: string, onChange: (pokes: Poke[]) => void): Unsubscribe;
  /** Nudges I sent, newest first — what the daily cap is read from. */
  watchSent(uid: string, onChange: (pokes: Poke[]) => void): Unsubscribe;

  /**
   * Sends a nudge. Resolves to null when today's has already been spent.
   *
   * The cap is not a courtesy the client extends: the document id encodes
   * sender, recipient, kind and day, and creates are the only write clients
   * may make, so a second one collides and fails. A modified client cannot
   * spam somebody.
   */
  sendPoke(
    fromUid: string,
    to: PublicProfile,
    kind: PokeKind,
    groupId?: string,
  ): Promise<Poke | null>;

  markInboxRead(uid: string, pokeIds: string[]): Promise<void>;

  // ── Groups ───────────────────────────────────────────────────────────────
  //
  // A group is the only shared, MUTABLE object in the app: several people write
  // to one document. That shapes the API — every method takes the acting uid,
  // because who is asking decides what is permitted, and none of them takes a
  // whole group object, because sending the client's idea of the member list
  // back to the server is how one person's stale screen silently removes
  // somebody else.

  /** Groups this user belongs to, newest first. */
  watchGroups(uid: string, onChange: (groups: Group[]) => void): Unsubscribe;

  /**
   * Creates a group with this user as its only member and its owner.
   *
   * The join code is reserved before the group exists, so two people creating a
   * group at the same moment cannot end up sharing a code — the second
   * reservation fails and a new code is drawn.
   */
  createGroup(uid: string, name: string, kind?: GroupKind): Promise<Group>;

  /** Joins by code. See `JoinResult` for why this is not `Group | null`. */
  joinGroup(uid: string, code: string): Promise<JoinResult>;

  /** Leaves. The last member out does not delete it; see the note on `Group`. */
  leaveGroup(uid: string, groupId: string): Promise<void>;

  /** Adds somebody else. Only the owner may do this. */
  addToGroup(uid: string, groupId: string, memberUid: string): Promise<void>;

  /** Removes somebody. The owner may remove anyone; anyone may remove self. */
  removeFromGroup(uid: string, groupId: string, memberUid: string): Promise<void>;

  // ── Club runs ────────────────────────────────────────────────────────────

  /**
   * Posts a finished run to every group the runner is in.
   *
   * Fan-out on write: one copy per group. A person is in a handful of groups
   * at most, and the alternative — one shared run with a query across members
   * — tops out at 30 members per Firestore `in` clause, which is smaller than
   * a single Saturday run club.
   */
  /**
   * Posts a run to clubs, and lights the city with it when `city` is given.
   *
   * One write: the city run is only accepted alongside the club run it came
   * from, so the two can never disagree.
   */
  postRun(uid: string, run: ClubRun, groupIds: string[], city?: CityPost): Promise<void>;

  /** City runs in these regions since `sinceMs`. */
  watchCity(
    regions: string[],
    sinceMs: number,
    onChange: (runs: CityRun[]) => void,
  ): Unsubscribe;

  /** A group's runs from `sinceDay` on, newest first. */
  watchGroupRuns(
    groupId: string,
    sinceDay: string,
    onChange: (runs: ClubRun[]) => void,
  ): Unsubscribe;
}

/**
 * The outcome of typing a code.
 *
 * Three outcomes, not two, because "you are already in that group" is not a
 * failure and must not be reported as one — the older code returned the group
 * either way and the screen could not tell the difference, so re-entering your
 * own code read as a fresh join.
 */
/** What a run adds to the map. Only clubs (not squads) light blocks. */
export type CityPost = {
  cells: string[];
  region: string;
  clubs: Array<{ id: string; name: string }>;
};

export type JoinResult =
  | { state: 'joined'; group: Group }
  | { state: 'already'; group: Group }
  | { state: 'unknown' };

/**
 * Join codes are the document id of their reservation, so they are normalised
 * in exactly one place: uppercased, with the separators people add when typing
 * something they heard removed. A code that failed because somebody wrote
 * WOLF-42 would be failing for the wrong reason.
 *
 * It deliberately does NOT drop characters outside the generator's alphabet.
 * An earlier version did, on the theory that it was being forgiving — but the
 * alphabet excludes O and 2, so it quietly turned WOLF42 into WLF4 and then
 * reported the result as an unknown code. Worse than the confusing error is the
 * near miss: a mangled code can land on a DIFFERENT real group. Cleaning input
 * is a kindness; rewriting it is not.
 */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_.]+/g, '');
}

/** Six characters: short enough to say across a room, long enough to be unique. */
export function makeGroupCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * The document id that makes the daily cap structural.
 *
 * Same trick as a session's id being its calendar day: the constraint lives in
 * the key rather than in a check somebody has to remember to write.
 */
export const pokeId = (
  fromUid: string,
  toUid: string,
  kind: PokeKind,
  day: string,
): string => `${fromUid}_${toUid}_${kind}_${day}`;

/** Handles are compared case-insensitively and stored without the leading @. */
export const normaliseHandle = (raw: string): string =>
  raw.trim().replace(/^@+/, '').toLowerCase();

export type HandleCheck =
  | { state: 'empty' }
  | { state: 'invalid'; reason: string }
  | { state: 'valid'; handle: string };

/**
 * Validates a handle before it is claimed.
 *
 * Deliberately narrow: letters, digits, underscore. A handle is read aloud and
 * typed by someone else looking for you, so anything that needs escaping or
 * looks different in another font does not belong in one.
 */
export function checkHandle(raw: string): HandleCheck {
  const handle = normaliseHandle(raw);
  if (handle.length === 0) {
    return { state: 'empty' };
  }
  if (handle.length < 3) {
    return { state: 'invalid', reason: 'At least 3 characters.' };
  }
  if (handle.length > 20) {
    return { state: 'invalid', reason: 'At most 20 characters.' };
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return { state: 'invalid', reason: 'Letters, numbers and underscores only.' };
  }
  return { state: 'valid', handle };
}
