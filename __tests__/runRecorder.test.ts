import { createAccumulator, summarise } from '../src/services/location';
import {
  IDLE_STATUS,
  attach,
  feedPoints,
  movingSeconds,
  type NativeRecorder,
  type RawPoint,
} from '../src/services/runRecorder';

// ~0.0009° of latitude is ~100 m.
const STEP = 0.0009;
const at = (i: number, segment = 0, t0 = 0): RawPoint => [
  23.0 + i * STEP,
  72.5,
  t0 + i * 30_000,
  8,
  segment,
];

describe('movingSeconds', () => {
  const base = { ...IDLE_STATUS, active: true, startedAt: 1_000_000 };

  it('is zero with no run', () => {
    expect(movingSeconds(IDLE_STATUS, 5_000_000)).toBe(0);
  });

  it('counts wall time while moving', () => {
    expect(movingSeconds(base, 1_000_000 + 90_000)).toBe(90);
  });

  it('leaves out banked pauses and the pause in progress', () => {
    const s = { ...base, pausedMs: 30_000, pausedSince: 1_000_000 + 100_000, paused: true };
    // 200s on the clock, 30s banked, 100s into the current pause.
    expect(movingSeconds(s, 1_000_000 + 200_000)).toBe(70);
  });

  it('never goes negative on a clock that moved backwards', () => {
    expect(movingSeconds(base, 900_000)).toBe(0);
  });
});

describe('feedPoints', () => {
  it('measures points delivered in several pulls the same as in one', () => {
    const all = [0, 1, 2, 3, 4, 5].map(i => at(i));

    const once = createAccumulator();
    feedPoints(once, all, null);

    const inParts = createAccumulator();
    let seg = feedPoints(inParts, all.slice(0, 2), null);
    seg = feedPoints(inParts, all.slice(2, 3), seg);
    feedPoints(inParts, all.slice(3), seg);

    expect(summarise(inParts.segments).distanceKm).toBe(summarise(once.segments).distanceKm);
    expect(summarise(once.segments).distanceKm).toBeCloseTo(0.5, 1);
  });

  it('never counts the gap across a pause as distance', () => {
    const acc = createAccumulator();
    // 300 m, pause, walk 2 km elsewhere off the clock, then 300 m more.
    const before = [0, 1, 2, 3].map(i => at(i, 0));
    const after = [20, 21, 22, 23].map(i => at(i, 1, 600_000));
    const seg = feedPoints(acc, before, null);
    feedPoints(acc, after, seg);

    const summary = summarise(acc.segments.filter(s => s.length > 0));
    expect(summary.segments).toHaveLength(2);
    expect(summary.distanceKm).toBeCloseTo(0.6, 1);
  });

  it('breaks a segment even when the pause falls between two pulls', () => {
    const acc = createAccumulator();
    const seg = feedPoints(acc, [at(0, 0), at(1, 0)], null);
    expect(seg).toBe(0);
    feedPoints(acc, [at(30, 1, 900_000), at(31, 1, 900_000)], seg);
    expect(acc.segments.filter(s => s.length > 0)).toHaveLength(2);
  });
});

describe('attach', () => {
  /** A recorder whose calls resolve only when the test says so. */
  function slowRecorder(points: RawPoint[]) {
    const waiting: Array<() => void> = [];
    const later = <T,>(value: () => T) =>
      new Promise<T>(resolve => waiting.push(() => resolve(value())));
    const status = { ...IDLE_STATUS, active: true, startedAt: 1 };
    const n: NativeRecorder = {
      start: async () => status,
      ensureRecording: async () => status,
      pause: async () => status,
      resume: async () => status,
      getStatus: () => later(() => status),
      pointsSince: from => later(() => points.slice(from)),
      finish: async () => true,
      isBatteryUnrestricted: async () => true,
      openBatterySettings: async () => true,
    };
    const flush = async () => {
      while (waiting.length > 0) {
        waiting.splice(0).forEach(f => f());
        await Promise.resolve();
        await Promise.resolve();
      }
    };
    return { n, flush };
  }

  it('does not double the distance when pulls overlap', async () => {
    const points = [0, 1, 2].map(i => at(i));
    const { n, flush } = slowRecorder(points);

    const attaching = attach(n, { ...IDLE_STATUS, active: true });
    await flush();
    const run = await attaching;

    // More of the run arrives while the screen was off.
    points.push(...[3, 4, 5, 6, 7, 8, 9, 10].map(i => at(i)));

    // The clock tick and the return from the lock screen, together.
    const a = run.sync();
    const b = run.sync();
    await flush();
    await Promise.all([a, b]);

    expect(run.summary().distanceKm).toBeCloseTo(1.0, 1);
  });
});
