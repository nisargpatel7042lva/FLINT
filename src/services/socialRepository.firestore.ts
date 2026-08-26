import {
  collection,
  deleteDoc,
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
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

import { requireFirebase } from './backend';
import { pokeMessage, todayKey, type Poke, type PokeKind } from './social';
import {
  normaliseHandle,
  pokeId,
  type PublicProfile,
  type SocialRepository,
} from './socialRepository';
import type { Unsubscribe } from './repository';

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
