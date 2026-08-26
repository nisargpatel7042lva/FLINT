import { CURRENT_USER_ID, GROUPS } from '../src/services/mockData';
import {
  CODE_ALPHABET,
  generateCode,
  socialStore,
  todayKey,
} from '../src/services/social';

beforeEach(() => {
  socialStore.reset();
});

describe('generateCode', () => {
  it('only uses characters people cannot misread', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateCode();
      expect(code).toHaveLength(6);
      for (const ch of code) {
        expect(CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('avoids codes already in use', () => {
    // Feed back everything generated so far; the next one must still be new.
    const taken: string[] = [];
    for (let i = 0; i < 100; i += 1) {
      const code = generateCode(taken);
      expect(taken).not.toContain(code);
      taken.push(code);
    }
  });

  it('matches regardless of the case the caller stored', () => {
    const code = generateCode();
    expect(generateCode([code.toLowerCase()])).not.toBe(code);
  });
});

describe('groups', () => {
  it('creates a group with the current user in it', () => {
    const group = socialStore.createGroup('  Morning Crew  ');
    expect(group.name).toBe('Morning Crew');
    expect(group.memberIds).toEqual([CURRENT_USER_ID]);
    expect(socialStore.getState().groups[0].id).toBe(group.id);
  });

  it('never reuses a fixture group code', () => {
    const codes = new Set(GROUPS.map(g => g.code));
    for (let i = 0; i < 30; i += 1) {
      expect(codes.has(socialStore.createGroup(`Squad ${i}`).code)).toBe(false);
    }
  });

  it('joins by code, case-insensitively', () => {
    socialStore.leaveGroup('g1');
    const joined = socialStore.joinGroup('  wolf42 ');
    expect(joined?.id).toBe('g1');
    expect(joined?.memberIds).toContain(CURRENT_USER_ID);
  });

  it('returns null for a code nobody has', () => {
    expect(socialStore.joinGroup('NOPE99')).toBeNull();
    expect(socialStore.joinGroup('')).toBeNull();
  });

  it('does not add a second copy when joining a group already joined', () => {
    const before = socialStore.getState().groups.length;
    socialStore.joinGroup('WOLF42');
    expect(socialStore.getState().groups).toHaveLength(before);
  });

  it('adds and removes members', () => {
    const group = socialStore.createGroup('Test Squad');
    socialStore.addToGroup(group.id, 'm7');
    socialStore.addToGroup(group.id, 'm7'); // idempotent
    expect(
      socialStore.getState().groups.find(g => g.id === group.id)?.memberIds,
    ).toEqual([CURRENT_USER_ID, 'm7']);

    socialStore.removeFromGroup(group.id, 'm7');
    expect(
      socialStore.getState().groups.find(g => g.id === group.id)?.memberIds,
    ).toEqual([CURRENT_USER_ID]);
  });

  it('leaves a group', () => {
    const group = socialStore.createGroup('Temporary');
    socialStore.leaveGroup(group.id);
    expect(socialStore.getState().groups.find(g => g.id === group.id)).toBeUndefined();
  });
});

describe('friends', () => {
  it('adds without duplicating', () => {
    socialStore.addFriend('m9');
    socialStore.addFriend('m9');
    expect(socialStore.getState().friendIds.filter(f => f === 'm9')).toHaveLength(1);
  });

  it('removes', () => {
    socialStore.addFriend('m9');
    socialStore.removeFriend('m9');
    expect(socialStore.getState().friendIds).not.toContain('m9');
  });
});

describe('nudges', () => {
  it('sends one and records it against the local day', () => {
    const poke = socialStore.sendPoke('m5', 'poke');
    expect(poke).not.toBeNull();
    expect(poke?.fromId).toBe(CURRENT_USER_ID);
    expect(poke?.day).toBe(todayKey());
  });

  it('caps at one per person per kind per day', () => {
    expect(socialStore.sendPoke('m5', 'poke')).not.toBeNull();
    expect(socialStore.sendPoke('m5', 'poke')).toBeNull();
    expect(socialStore.pokeSpent('m5', 'poke')).toBe(true);
  });

  it('counts a challenge separately from a nudge', () => {
    socialStore.sendPoke('m5', 'poke');
    expect(socialStore.sendPoke('m5', 'challenge')).not.toBeNull();
  });

  it('caps per person, not globally', () => {
    socialStore.sendPoke('m5', 'poke');
    expect(socialStore.sendPoke('m6', 'poke')).not.toBeNull();
  });

  it('does not treat a day-old nudge as spent', () => {
    /*
     * The cap must be counted in the sender's own calendar day. Slicing an ISO
     * timestamp gives the UTC date, which is a different day from local for
     * part of every night anywhere ahead of UTC — this guards that regression.
     */
    socialStore.sendPoke('m5', 'poke');
    const state = socialStore.getState();
    state.pokes[0].day = '2000-01-01';
    expect(socialStore.pokeSpent('m5', 'poke')).toBe(false);
  });

  it('marks received nudges read', () => {
    expect(socialStore.getState().pokes.some(p => !p.read)).toBe(true);
    socialStore.markPokesRead();
    expect(socialStore.getState().pokes.every(p => p.read)).toBe(true);
  });

  it('seeds an inbox so the feature is visible on a fresh install', () => {
    const inbound = socialStore
      .getState()
      .pokes.filter(p => p.toId === CURRENT_USER_ID);
    expect(inbound.length).toBeGreaterThan(0);
  });
});
