import { MIN_REP_MS, createRepCounter, pushupStats } from '../src/services/focus';

describe('push-up counting', () => {
  it('counts one rep per down-up cycle, on the way down', () => {
    const reps: number[] = [];
    const c = createRepCounter(r => reps.push(r));
    let t = 0;
    for (let i = 0; i < 5; i += 1) {
      c.reading(true, (t += 700));
      c.reading(false, (t += 700));
    }
    expect(c.reps).toBe(5);
    expect(reps).toEqual([1, 2, 3, 4, 5]);
  });

  it('ignores sensor flicker faster than a human can move', () => {
    const c = createRepCounter(() => {});
    c.reading(true, 1000);
    c.reading(false, 1050);
    c.reading(true, 1100); // 100 ms later: flicker
    c.reading(false, 1150);
    c.reading(true, 1000 + MIN_REP_MS + 10);
    expect(c.reps).toBe(2);
  });

  it('does not count staying down as more reps', () => {
    const c = createRepCounter(() => {});
    c.reading(true, 1000);
    c.reading(true, 3000);
    c.reading(true, 5000);
    expect(c.reps).toBe(1);
  });

  it('counts taps the same way', () => {
    const c = createRepCounter(() => {});
    c.tap(1000);
    c.tap(1100); // a double tap is one rep
    c.tap(2000);
    expect(c.reps).toBe(2);
  });
});

describe('pushupStats', () => {
  it('finds the best set and today’s total', () => {
    const sets = [
      { reps: 12, seconds: 30, at: '2026-10-20T08:00:00Z' },
      { reps: 20, seconds: 50, at: '2026-10-19T08:00:00Z' },
      { reps: 8, seconds: 20, at: '2026-10-20T12:00:00Z' },
    ];
    expect(pushupStats(sets, '2026-10-20')).toEqual({ best: 20, today: 20 });
  });
});
