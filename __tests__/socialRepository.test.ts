import {
  checkHandle,
  makeGroupCode,
  normaliseCode,
  normaliseHandle,
  pokeId,
} from '../src/services/socialRepository';
import { LocalSocialRepository } from '../src/services/socialRepository.local';
import { socialStore } from '../src/services/social';
import { CURRENT_USER_ID } from '../src/services/mockData';
import type { Group } from '../src/services/types';

describe('normaliseHandle', () => {
  it('strips the @ and lowercases', () => {
    expect(normaliseHandle('  @NiSarG ')).toBe('nisarg');
  });

  it('strips repeated @, which people paste', () => {
    expect(normaliseHandle('@@ava')).toBe('ava');
  });
});

describe('checkHandle', () => {
  it('accepts a normal handle', () => {
    expect(checkHandle('@Nisarg_7')).toEqual({ state: 'valid', handle: 'nisarg_7' });
  });

  it('reports empty separately from invalid, so the UI can stay quiet', () => {
    expect(checkHandle('   ').state).toBe('empty');
  });

  it('rejects handles that are too short or too long', () => {
    expect(checkHandle('ab').state).toBe('invalid');
    expect(checkHandle('a'.repeat(21)).state).toBe('invalid');
  });

  it('rejects anything that needs escaping or reads ambiguously', () => {
    for (const bad of ['ava cole', 'ava.cole', 'ava/cole', 'avaé', 'ava-cole']) {
      expect(checkHandle(bad).state).toBe('invalid');
    }
  });

  it('agrees with the pattern the security rules enforce', () => {
    // The rules use ^[a-z0-9_]{3,20}$. If these two ever drift, a handle the
    // client accepts is a write the server rejects.
    const rulePattern = /^[a-z0-9_]{3,20}$/;
    for (const candidate of ['abc', 'a_b_c', 'nisarg7042', 'x'.repeat(20)]) {
      const result = checkHandle(candidate);
      expect(result.state).toBe('valid');
      if (result.state === 'valid') {
        expect(rulePattern.test(result.handle)).toBe(true);
      }
    }
  });
});

describe('pokeId', () => {
  it('encodes sender, recipient, kind and day', () => {
    expect(pokeId('a', 'b', 'poke', '2026-08-26')).toBe('a_b_poke_2026-08-26');
  });

  it('differs per kind, so a challenge does not consume the nudge', () => {
    expect(pokeId('a', 'b', 'poke', '2026-08-26')).not.toBe(
      pokeId('a', 'b', 'challenge', '2026-08-26'),
    );
  });

  it('matches the concatenation the security rules recompute', () => {
    const [from, to, kind, day] = ['alice', 'bob', 'poke', '2026-08-26'] as const;
    expect(pokeId(from, to, kind, day)).toBe(`${from}_${to}_${kind}_${day}`);
  });
});

describe('LocalSocialRepository', () => {
  const repo = new LocalSocialRepository();

  beforeEach(() => {
    socialStore.reset();
  });

  it('reports itself as local so the UI can say nudges do not leave the device', () => {
    expect(repo.kind).toBe('local');
  });

  it('finds people by name or handle', async () => {
    const found = await repo.searchProfiles('ava', CURRENT_USER_ID);
    expect(found.map(p => p.handle)).toContain('@avacole');
  });

  it('never returns the searcher themselves', async () => {
    const found = await repo.searchProfiles('', CURRENT_USER_ID);
    expect(found.map(p => p.uid)).not.toContain(CURRENT_USER_ID);
  });

  it('sends a nudge and refuses the second one that day', async () => {
    const to = { uid: 'm5', name: 'Dan Reed', handle: '@danreed' };
    expect(await repo.sendPoke(CURRENT_USER_ID, to, 'poke')).not.toBeNull();
    expect(await repo.sendPoke(CURRENT_USER_ID, to, 'poke')).toBeNull();
  });

  it('surfaces the inbox and the sent list separately', async () => {
    const to = { uid: 'm5', name: 'Dan Reed', handle: '@danreed' };
    await repo.sendPoke(CURRENT_USER_ID, to, 'poke');

    let inbox: unknown[] = [];
    let sent: unknown[] = [];
    repo.watchInbox(CURRENT_USER_ID, p => (inbox = p));
    repo.watchSent(CURRENT_USER_ID, p => (sent = p));

    // Seeded inbound nudges are addressed to us; the one we just sent is not.
    expect(inbox.length).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
  });
});

describe('LocalSocialRepository identity', () => {
  const repo = new LocalSocialRepository();

  beforeEach(() => {
    socialStore.reset();
  });

  /*
   * Regression: without Firebase, `ensureSignedIn()` returns 'local-user',
   * which has no fixture behind it. Filtering the seeded nudges by that id
   * matched nothing — the inbox rendered empty and the daily cap stopped
   * showing, because the sent list the cap reads from was always empty too.
   */
  it('still finds the inbox when handed a uid with no fixture behind it', () => {
    let inbox: { toId: string }[] = [];
    repo.watchInbox('local-user', p => (inbox = p));
    expect(inbox.length).toBeGreaterThan(0);
    expect(inbox.every(p => p.toId === CURRENT_USER_ID)).toBe(true);
  });

  it('still reports what was sent, so the daily cap shows', async () => {
    const to = { uid: 'm5', name: 'Dan Reed', handle: '@danreed' };
    await repo.sendPoke('local-user', to, 'poke');

    let sent: unknown[] = [];
    repo.watchSent('local-user', p => (sent = p));
    expect(sent).toHaveLength(1);
  });

  it('never offers the fixture user themselves in search', async () => {
    const found = await repo.searchProfiles('', 'local-user');
    expect(found.map(p => p.uid)).not.toContain(CURRENT_USER_ID);
  });
});

describe('normaliseCode', () => {
  it('uppercases and trims', () => {
    expect(normaliseCode('  wolf42 ')).toBe('WOLF42');
  });

  /*
   * Codes get read out across a room far more often than they get pasted, so
   * the listener types spaces and dashes into what they heard.
   */
  it('drops separators people add when typing what they heard', () => {
    expect(normaliseCode('WOLF-42')).toBe('WOLF42');
    expect(normaliseCode('WOL F42')).toBe('WOLF42');
  });

  /*
   * The regression this exists for.
   *
   * An earlier version filtered out every character missing from the code
   * alphabet, which excludes O and 2 - so a perfectly real code came back as
   * WLF4 and matched either nothing or, far worse, somebody else's group.
   */
  it('never rewrites the characters of a code', () => {
    expect(normaliseCode('WOLF42')).toBe('WOLF42');
    expect(normaliseCode('  wolf42 ')).toBe('WOLF42');
  });

  it('is empty only when there was nothing but whitespace', () => {
    expect(normaliseCode('   ')).toBe('');
  });

  it('is idempotent', () => {
    const once = normaliseCode('wolf-42');
    expect(normaliseCode(once)).toBe(once);
  });
});

describe('makeGroupCode', () => {
  it('is six characters from the shared alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = makeGroupCode();
      expect(code).toHaveLength(6);
      // Survives normalisation unchanged, so a code is always typeable back in.
      expect(normaliseCode(code)).toBe(code);
    }
  });

  it('does not repeat itself in any reasonable run', () => {
    const seen = new Set(Array.from({ length: 200 }, () => makeGroupCode()));
    // The alphabet gives ~191 million codes, so 200 draws colliding would mean
    // the generator is not actually random.
    expect(seen.size).toBe(200);
  });
});

describe('local groups', () => {
  const repo = new LocalSocialRepository();

  /** The uid is ignored by the local repository; see the note in that file. */
  const ME = 'ignored';

  /*
   * The current group list.
   *
   * `watchGroups` emits synchronously on subscribe, so the value is already in
   * hand by the time the call returns. Wrapping this in a promise that resolves
   * from inside the callback would deadlock on its own unsubscribe handle,
   * which is not yet assigned when the first emission fires.
   */
  const snapshot = (): Group[] => {
    let out: Group[] = [];
    const unsub = repo.watchGroups(ME, groups => {
      out = groups;
    });
    unsub();
    return out;
  };

  const membersOf = (id: string) =>
    snapshot().find(g => g.id === id)?.memberIds ?? [];

  it('creates a group with you in it and a code to share', async () => {
    const group = await repo.createGroup(ME, '  Morning Crew  ');

    expect(group.name).toBe('Morning Crew');
    expect(group.memberIds).toContain(CURRENT_USER_ID);
    expect(group.ownerUid).toBe(CURRENT_USER_ID);
    expect(normaliseCode(group.code)).toBe(group.code);
  });

  it('reports re-entering your own code as already joined, not as a failure', async () => {
    const created = await repo.createGroup(ME, 'Night Crew');

    const again = await repo.joinGroup(ME, created.code);
    expect(again.state).toBe('already');
  });

  it('reports a code with nothing behind it as unknown', async () => {
    expect((await repo.joinGroup(ME, 'ZZZZZZ')).state).toBe('unknown');
  });

  it('treats an unusable code as unknown rather than throwing', async () => {
    expect((await repo.joinGroup(ME, '   ')).state).toBe('unknown');
  });

  it('adds and removes members', async () => {
    const created = await repo.createGroup(ME, 'Add Remove');

    await repo.addToGroup(ME, created.id, 'm7');
    expect(membersOf(created.id)).toContain('m7');

    await repo.removeFromGroup(ME, created.id, 'm7');
    expect(membersOf(created.id)).not.toContain('m7');
  });

  it('drops the group from your list when you leave', async () => {
    const created = await repo.createGroup(ME, 'Leaving Soon');
    await repo.leaveGroup(ME, created.id);

    expect(snapshot().some(g => g.id === created.id)).toBe(false);
  });

  it('gives every group its own code', async () => {
    const a = await repo.createGroup(ME, 'Crew A');
    const b = await repo.createGroup(ME, 'Crew B');
    expect(a.code).not.toBe(b.code);
  });
});
