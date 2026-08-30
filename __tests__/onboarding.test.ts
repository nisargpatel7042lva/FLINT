import {
  BARRIERS,
  BARRIER_IDS,
  FLOW_LENGTH,
  FLOW_STEPS,
  barrierById,
  barrierPayoff,
  barrierReminder,
  flowIndex,
} from '../src/services/onboarding';
import {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  type TrainingProfile,
} from '../src/services/profile';

describe('barriers', () => {
  it('offers exactly one dominant answer', () => {
    expect(BARRIERS.filter(b => b.weight === 'primary')).toHaveLength(1);
  });

  it('lists every id, and only real ones', () => {
    expect([...BARRIER_IDS].sort()).toEqual(BARRIERS.map(b => b.id).sort());
  });

  it('answers the barrier that was picked rather than acknowledging it', () => {
    /*
     * The whole opening rests on the reply being specific. A generic "got it"
     * would make the question decorative, so every response has to differ.
     */
    const lines = BARRIERS.map(b => b.response.line);
    expect(new Set(lines).size).toBe(BARRIERS.length);
  });

  it('falls back rather than throwing on an id it does not know', () => {
    expect(barrierById('nonsense' as never)).toBe(BARRIERS[0]);
  });
});

describe('barrierPayoff', () => {
  it('answers "no time" with the time it actually cost', () => {
    expect(barrierPayoff('no_time', 4)).toContain('4 minutes');
  });

  it('reads as speech rather than a metric for a one-minute session', () => {
    const text = barrierPayoff('no_time', 1);
    expect(text).toContain('about a minute');
    expect(text).not.toContain('1 minutes');
  });

  it('leaves no placeholder visible for any barrier', () => {
    BARRIER_IDS.forEach(id => {
      expect(barrierPayoff(id, 7)).not.toContain('{minutes}');
    });
  });

  it('never scolds — this fires when somebody has just succeeded', () => {
    BARRIER_IDS.forEach(id => {
      const text = `${barrierPayoff(id, 5)} ${barrierReminder(id)}`.toLowerCase();
      ['should', 'failed', 'excuse', 'lazy', 'finally'].forEach(word =>
        expect(text).not.toContain(word),
      );
    });
  });
});

describe('flow', () => {
  it('counts the steps that ask something, and not the splash', () => {
    expect(FLOW_LENGTH).toBe(FLOW_STEPS.length);
    expect(FLOW_STEPS).not.toContain('Splash');
  });

  it('orders the steps as the screens navigate', () => {
    expect(flowIndex('Barrier')).toBeLessThan(flowIndex('Place'));
    expect(flowIndex('Place')).toBeLessThan(flowIndex('Time'));
    expect(flowIndex('Time')).toBeLessThan(flowIndex('Session'));
  });
});

describe('the barrier survives the opening', () => {
  /*
   * The point of asking is that the answer comes back later — on the ignition
   * screen, on a cold morning's dashboard, and on the profile. If it does not
   * round-trip through storage, the app has taken an admission and given
   * nothing back.
   */
  const write = (patch: Partial<TrainingProfile>) =>
    saveProfile({ ...DEFAULT_PROFILE, ...patch });

  it('round-trips through storage', async () => {
    await write({ barrier: 'lose_interest' });
    expect((await loadProfile()).barrier).toBe('lose_interest');
  });

  it('drops a stored value that is not a barrier', async () => {
    await write({ barrier: 'whatever' as never });
    expect((await loadProfile()).barrier).toBeUndefined();
  });

  it('is absent, not defaulted, when the question was never answered', async () => {
    await write({});
    expect((await loadProfile()).barrier).toBeUndefined();
  });

  it('remembers that the opening finished, so it is never replayed', async () => {
    await write({ completed: true });
    expect((await loadProfile()).completed).toBe(true);
  });
});
