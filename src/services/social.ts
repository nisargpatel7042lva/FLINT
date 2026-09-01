import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_USER_ID, GROUPS, MEMBERS, TODAY } from './mockData';
import type { Group, Member } from './types';

/**
 * Groups, friends and pokes.
 *
 * This is the mutable half of the social model. `mockData` supplies the cast of
 * people and the seed groups; everything a user actually *does* — creating a
 * squad, joining one, adding a friend, poking someone — lands here and is
 * persisted, so a group you made survives a relaunch instead of evaporating
 * the way the in-memory training repository does.
 *
 * It is deliberately device-local for now. When Firestore is configured this
 * whole module is what gets swapped, and no screen changes: screens only ever
 * touch `socialStore` and the `useSocial` hook.
 */

/**
 * Group codes share the enrolment alphabet — no O/0, I/1, S/5, B/8 — because
 * these get read aloud across a room ("join WOLF42") far more often than they
 * get copy-pasted.
 */
export const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349';

export type PokeKind = 'poke' | 'challenge' | 'cheer';

export type Poke = {
  id: string;
  fromId: string;
  toId: string;
  kind: PokeKind;
  message: string;
  /** Set when the nudge was sent from inside a group. */
  groupId?: string;
  /** Local calendar day, `YYYY-MM-DD`. What the daily cap is counted against. */
  day: string;
  createdAt: string;
  read: boolean;
};

/**
 * Local-date key; see the note in `training.ts` on why not `toISOString()`.
 *
 * The daily poke cap has to be counted in the sender's own day. Slicing an ISO
 * string gives the UTC date, so anywhere ahead of UTC the cap would come apart
 * every night — at IST, a nudge sent at 09:00 local carries yesterday's UTC
 * date until 05:30, and the "already nudged" check silently misses it.
 */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** The sender's current local day. */
export const todayKey = () => dayKey(new Date());

export type SocialState = {
  /** Groups the user has created or joined. */
  groups: Group[];
  /** Member ids the user has added as friends. */
  friendIds: string[];
  pokes: Poke[];
};

const KEY = 'kasrat.social.v1';

/**
 * Poke copy.
 *
 * Spark's voice rule applies here too: a nudge is an invitation, never an
 * accusation. Nothing in this list mentions falling behind, breaking a streak,
 * or letting anyone down — a poke that lands as a telling-off is a poke people
 * turn off, and then the feature is worth nothing.
 */
const POKE_COPY: Record<PokeKind, string[]> = {
  poke: [
    'is thinking of you. No pressure — just a wave.',
    'says the door is open whenever you fancy it.',
    'reckons today looks like a good day for it.',
  ],
  challenge: [
    'wants to go head to head. Fancy it?',
    'is calling you out — in the friendliest possible way.',
    'has thrown down a challenge.',
  ],
  cheer: [
    'saw your session and is genuinely impressed.',
    'is cheering you on.',
    'says that one counted.',
  ],
};

/**
 * Seeded so a fresh install is not an empty room.
 *
 * The two inbound pokes are fixture data, in the same spirit as the seeded
 * submissions and notifications: without them the inbox is empty until someone
 * else runs the app, and a feature you cannot see is a feature you cannot
 * judge. They are the only pokes not sent by the current user.
 */
function seed(): SocialState {
  const hoursAgo = (h: number) =>
    new Date(Date.now() - h * 3600 * 1000).toISOString();

  return {
    groups: GROUPS.filter(g => g.memberIds.includes(CURRENT_USER_ID)),
    friendIds: MEMBERS.filter(m => m.id !== CURRENT_USER_ID)
      .slice(0, 3)
      .map(m => m.id),
    pokes: [
      {
        id: 'seed-poke-1',
        fromId: 'm2',
        toId: CURRENT_USER_ID,
        kind: 'poke',
        message: POKE_COPY.poke[0],
        groupId: 'g1',
        day: dayKey(new Date(Date.now() - 3 * 3600 * 1000)),
        createdAt: hoursAgo(3),
        read: false,
      },
      {
        id: 'seed-poke-2',
        fromId: 'm4',
        toId: CURRENT_USER_ID,
        kind: 'challenge',
        message: POKE_COPY.challenge[0],
        groupId: 'g1',
        day: dayKey(new Date(Date.now() - 20 * 3600 * 1000)),
        createdAt: hoursAgo(20),
        read: false,
      },
    ],
  };
}

export function pokeMessage(kind: PokeKind, seedIndex: number): string {
  const options = POKE_COPY[kind];
  return options[seedIndex % options.length];
}

const LABEL: Record<PokeKind, string> = {
  poke: 'Nudge',
  challenge: 'Challenge',
  cheer: 'Cheer',
};

export const pokeLabel = (kind: PokeKind) => LABEL[kind];

/** Six characters is short enough to say out loud and long enough to be unique. */
export function generateCode(existing: string[] = []): string {
  const taken = new Set(existing.map(c => c.toUpperCase()));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!taken.has(code)) {
      return code;
    }
  }
  // Astronomically unlikely; falling back to a timestamp beats looping forever.
  return `G${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

/**
 * A minimal observable store.
 *
 * Small enough not to justify a state library, and keeping it here means the
 * persistence rule ("every mutation writes") lives in exactly one place rather
 * than being re-remembered at each call site.
 */
class SocialStore {
  private state: SocialState = seed();
  private listeners = new Set<(s: SocialState) => void>();
  private ready = false;
  private loading: Promise<void> | null = null;

  /** Reads persisted state once; safe to call from every mounting screen. */
  async hydrate(): Promise<void> {
    if (this.ready) {
      return;
    }
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const raw = await AsyncStorage.getItem(KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<SocialState>;
            this.state = {
              groups: Array.isArray(parsed.groups) ? parsed.groups : this.state.groups,
              friendIds: Array.isArray(parsed.friendIds)
                ? parsed.friendIds
                : this.state.friendIds,
              pokes: Array.isArray(parsed.pokes) ? parsed.pokes : [],
            };
          }
        } catch {
          // Corrupt or unavailable storage falls back to the seed. Losing a
          // group list is not worth failing to open the app over.
        }
        this.ready = true;
        this.emit();
      })();
    }
    return this.loading;
  }

  getState(): SocialState {
    return this.state;
  }

  subscribe(fn: (s: SocialState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach(l => l(this.state));
  }

  private commit(next: SocialState) {
    this.state = next;
    this.emit();
    // Fire-and-forget: a failed write costs this change on next launch, which
    // is a far better outcome than blocking the tap that caused it.
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }

  createGroup(name: string): Group {
    const group: Group = {
      id: id('g'),
      name: name.trim(),
      code: generateCode([...this.state.groups.map(g => g.code), ...GROUPS.map(g => g.code)]),
      ownerUid: CURRENT_USER_ID,
      memberIds: [CURRENT_USER_ID],
      createdAt: TODAY,
    };
    this.commit({ ...this.state, groups: [group, ...this.state.groups] });
    return group;
  }

  /** Returns the joined group, or null when no group carries that code. */
  joinGroup(rawCode: string): Group | null {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return null;
    }

    const already = this.state.groups.find(g => g.code.toUpperCase() === code);
    if (already) {
      return already;
    }

    const found = GROUPS.find(g => g.code.toUpperCase() === code);
    if (!found) {
      return null;
    }

    const joined: Group = {
      ...found,
      memberIds: found.memberIds.includes(CURRENT_USER_ID)
        ? found.memberIds
        : [...found.memberIds, CURRENT_USER_ID],
    };
    this.commit({ ...this.state, groups: [joined, ...this.state.groups] });
    return joined;
  }

  leaveGroup(groupId: string) {
    this.commit({
      ...this.state,
      groups: this.state.groups.filter(g => g.id !== groupId),
    });
  }

  addToGroup(groupId: string, memberId: string) {
    this.commit({
      ...this.state,
      groups: this.state.groups.map(g =>
        g.id === groupId && !g.memberIds.includes(memberId)
          ? { ...g, memberIds: [...g.memberIds, memberId] }
          : g,
      ),
    });
  }

  removeFromGroup(groupId: string, memberId: string) {
    this.commit({
      ...this.state,
      groups: this.state.groups.map(g =>
        g.id === groupId
          ? { ...g, memberIds: g.memberIds.filter(m => m !== memberId) }
          : g,
      ),
    });
  }

  addFriend(memberId: string) {
    if (this.state.friendIds.includes(memberId)) {
      return;
    }
    this.commit({ ...this.state, friendIds: [...this.state.friendIds, memberId] });
  }

  removeFriend(memberId: string) {
    this.commit({
      ...this.state,
      friendIds: this.state.friendIds.filter(f => f !== memberId),
    });
  }

  /**
   * Sends a nudge, unless one of the same kind already went to that person
   * today. The cap is the whole reason this is a feature and not a nuisance:
   * without it, "poke" becomes a button people hold down.
   */
  sendPoke(toId: string, kind: PokeKind, groupId?: string): Poke | null {
    const spent = this.pokeSpent(toId, kind);
    if (spent) {
      return null;
    }

    const nudge: Poke = {
      id: id('n'),
      fromId: CURRENT_USER_ID,
      toId,
      kind,
      message: pokeMessage(kind, this.state.pokes.length),
      groupId,
      day: todayKey(),
      createdAt: new Date().toISOString(),
      read: true,
    };
    this.commit({ ...this.state, pokes: [nudge, ...this.state.pokes] });
    return nudge;
  }

  /** True when today's nudge of that kind has already been spent. */
  pokeSpent(toId: string, kind: PokeKind): boolean {
    const today = todayKey();
    return this.state.pokes.some(
      n =>
        n.fromId === CURRENT_USER_ID &&
        n.toId === toId &&
        n.kind === kind &&
        n.day === today,
    );
  }

  markPokesRead() {
    if (this.state.pokes.every(n => n.read)) {
      return;
    }
    this.commit({
      ...this.state,
      pokes: this.state.pokes.map(n => ({ ...n, read: true })),
    });
  }

  /** Test seam. Not used by the app. */
  reset() {
    this.state = seed();
    this.ready = false;
    this.loading = null;
    this.emit();
    AsyncStorage.removeItem(KEY).catch(() => {});
  }
}

export const socialStore = new SocialStore();

/** People not yet befriended — the pool the "find friends" screen offers. */
export function suggestedMembers(friendIds: string[]): Member[] {
  return MEMBERS.filter(m => m.id !== CURRENT_USER_ID && !friendIds.includes(m.id));
}
