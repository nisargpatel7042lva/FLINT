import { CURRENT_USER_ID, MEMBERS, memberById } from './mockData';
import { socialStore, type Poke, type PokeKind } from './social';
import { normaliseHandle, type PublicProfile, type SocialRepository } from './socialRepository';
import type { Unsubscribe } from './repository';

/**
 * Local social layer, used whenever Firebase is not configured.
 *
 * Backed by the persisted `socialStore` and the fixture cast, so the whole
 * feature is demonstrable on a machine that has never been handed credentials.
 *
 * What it deliberately does NOT do is pretend to deliver. A nudge sent here is
 * recorded on this device and nowhere else — there is no other device to reach.
 * The two nudges in the inbox are seeded fixtures, and `kind` says `local` so
 * the UI can say so rather than implying a message left the phone.
 *
 * Every method ignores the `uid` it is handed and uses `CURRENT_USER_ID`.
 * Without Firebase, `ensureSignedIn()` returns a placeholder id that has no
 * fixture behind it, so filtering the seeded nudges by it matches nothing: the
 * inbox empties and the daily cap silently stops applying. In this world the
 * fixture user IS the signed-in user.
 */

const toProfile = (id: string): PublicProfile => {
  const m = memberById(id);
  return { uid: m.id, name: m.name, handle: m.handle };
};

export class LocalSocialRepository implements SocialRepository {
  readonly kind = 'local' as const;

  async ensureProfile(uid: string, name: string, handle: string): Promise<PublicProfile> {
    return { uid, name: name.trim(), handle: `@${normaliseHandle(handle)}` };
  }

  async getProfile(uid: string): Promise<PublicProfile | null> {
    return MEMBERS.some(m => m.id === uid) ? toProfile(uid) : null;
  }

  async searchProfiles(term: string, _excludeUid: string): Promise<PublicProfile[]> {
    const q = normaliseHandle(term);
    return MEMBERS.filter(
      m =>
        m.id !== CURRENT_USER_ID &&
        (m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q)),
    ).map(m => ({ uid: m.id, name: m.name, handle: m.handle }));
  }

  watchFriends(_uid: string, onChange: (friends: PublicProfile[]) => void): Unsubscribe {
    return socialStore.subscribe(s => onChange(s.friendIds.map(toProfile)));
  }

  async addFriend(_uid: string, friend: PublicProfile): Promise<void> {
    socialStore.addFriend(friend.uid);
  }

  async removeFriend(_uid: string, friendUid: string): Promise<void> {
    socialStore.removeFriend(friendUid);
  }

  watchInbox(_uid: string, onChange: (pokes: Poke[]) => void): Unsubscribe {
    return socialStore.subscribe(s =>
      onChange(s.pokes.filter(p => p.toId === CURRENT_USER_ID)),
    );
  }

  watchSent(_uid: string, onChange: (pokes: Poke[]) => void): Unsubscribe {
    return socialStore.subscribe(s =>
      onChange(s.pokes.filter(p => p.fromId === CURRENT_USER_ID)),
    );
  }

  async sendPoke(
    _fromUid: string,
    to: PublicProfile,
    kind: PokeKind,
    groupId?: string,
  ): Promise<Poke | null> {
    return socialStore.sendPoke(to.uid, kind, groupId);
  }

  async markInboxRead(): Promise<void> {
    socialStore.markPokesRead();
  }
}
