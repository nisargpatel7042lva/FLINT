import {
  checkHandle,
  normaliseHandle,
  pokeId,
} from '../src/services/socialRepository';
import { LocalSocialRepository } from '../src/services/socialRepository.local';
import { socialStore } from '../src/services/social';
import { CURRENT_USER_ID } from '../src/services/mockData';

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
