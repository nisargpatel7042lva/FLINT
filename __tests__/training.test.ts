import {
  intensityLevel,
  buildPlan,
  charStage,
  currentStreak,
  estimateSeconds,
  longestStreak,
  streakAtRisk,
  type Focus,
  type SessionLog,
} from '../src/services/training';

/** Minimal log factory — only `day` matters for streak maths. */
const log = (day: string): SessionLog => ({
  id: day,
  day,
  title: 't',
  focus: 'full',
  minutes: 10,
  completedSets: 6,
  totalSets: 6,
  kcal: 100,
});

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    const logs = ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'].map(log);
    expect(currentStreak(logs, '2026-08-23')).toBe(4);
  });

  it('keeps the streak alive when today is not logged yet', () => {
    const logs = ['2026-08-20', '2026-08-21', '2026-08-22'].map(log);
    expect(currentStreak(logs, '2026-08-23')).toBe(3);
    expect(streakAtRisk(logs, '2026-08-23')).toBe(true);
  });

  it('breaks once a full day is missed', () => {
    const logs = ['2026-08-18', '2026-08-19'].map(log);
    expect(currentStreak(logs, '2026-08-23')).toBe(0);
  });

  it('is not at risk when today is already logged', () => {
    const logs = ['2026-08-22', '2026-08-23'].map(log);
    expect(streakAtRisk(logs, '2026-08-23')).toBe(false);
  });

  /**
   * Regression: date keys were built with toISOString(), which shifts local
   * midnight to the previous UTC day in any timezone ahead of UTC. Consecutive
   * days never matched, so every longest streak reported 1.
   */
  it('finds the longest run across a gap', () => {
    const logs = [
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      // gap
      '2026-08-10',
      '2026-08-11',
    ].map(log);
    expect(longestStreak(logs)).toBe(3);
  });

  it('spans a month boundary', () => {
    const logs = ['2026-07-30', '2026-07-31', '2026-08-01'].map(log);
    expect(longestStreak(logs)).toBe(3);
  });
});

describe('time-adaptive plans', () => {
  const budgets = [5, 10, 15, 20, 30];
  const foci: Focus[] = ['legs', 'upper', 'core', 'full', 'cardio'];

  it('never exceeds the requested budget', () => {
    for (const minutes of budgets) {
      for (const focus of foci) {
        const plan = buildPlan(minutes, focus);
        expect(estimateSeconds(plan)).toBeLessThanOrEqual(minutes * 60);
      }
    }
  });

  it('always produces at least two exercises', () => {
    for (const minutes of budgets) {
      for (const focus of foci) {
        expect(buildPlan(minutes, focus).exercises.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('names the session with its budget', () => {
    expect(buildPlan(12, 'legs').title).toBe('12-minute Legs Day');
  });

  /**
   * Regression: every focus used to produce the same shape at a given budget
   * ("4 moves / 12 sets" across all five), which reads as a bug rather than a
   * choice. Density now differs per focus.
   */
  it('produces meaningfully different sessions per focus', () => {
    const shapes = foci.map(f => {
      const p = buildPlan(15, f);
      return `${p.exercises.length}x${p.exercises[0].sets}`;
    });
    expect(new Set(shapes).size).toBeGreaterThan(1);
  });
});

describe('char stages', () => {
  it('starts at ember and can fall back', () => {
    expect(charStage(0).stage.id).toBe('ember');
    expect(charStage(2).stage.id).toBe('ember');
  });

  it('advances with the streak', () => {
    expect(charStage(3).stage.id).toBe('flame');
    expect(charStage(7).stage.id).toBe('blaze');
    expect(charStage(21).stage.id).toBe('wildfire');
    expect(charStage(60).stage.id).toBe('forge');
  });

  it('reports progress toward the next stage', () => {
    const { next, daysToNext } = charStage(5);
    expect(next?.id).toBe('blaze');
    expect(daysToNext).toBe(2);
  });

  it('has no next stage at the top', () => {
    expect(charStage(100).next).toBeNull();
  });
});


describe('intensity bands', () => {
  it('treats a rest day as level 0 and any session as at least 1', () => {
    expect(intensityLevel(0)).toBe(0);
    expect(intensityLevel(5)).toBe(1);
  });

  it('rises monotonically with minutes', () => {
    const levels = [0, 5, 12, 20, 30, 90].map(intensityLevel);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it('keeps a token effort and a real session in different bands', () => {
    // A 5-minute session must never share a band with a 30-minute one, or the
    // heatmap stops distinguishing a token effort from a real session.
    expect(intensityLevel(5)).not.toBe(intensityLevel(30));
    expect(intensityLevel(30)).toBe(4);
  });
});
