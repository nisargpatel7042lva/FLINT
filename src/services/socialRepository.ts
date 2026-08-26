import type { Poke, PokeKind } from './social';
import type { Unsubscribe } from './repository';

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
