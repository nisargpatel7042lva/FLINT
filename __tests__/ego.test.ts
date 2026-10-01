import {
  NEVER_SAY,
  TONES,
  passedLine,
  predictionLine,
  verdictLine,
} from '../src/services/ego';
import { judge, predict, type Prediction } from '../src/services/predictions';
import type { RunRecord } from '../src/services/runs';

let t = 0;
const run = (km: number, kind: RunRecord['kind'] = 'run'): RunRecord => {
  t += 1;
  return {
    id: `me_${t}`,
    kind,
    distanceKm: km,
    durationSec: km * 360,
    day: '2026-09-30',
    startedAt: new Date(1_790_000_000_000 + t * 86_400_000).toISOString(),
  };
};

describe('predict', () => {
  it('bets low for somebody with no history', () => {
    const p = predict([], 'run');
    expect(p.basis).toBe('first');
    expect(p.targetKm).toBe(2);
  });

  it('needs three runs before judging from history', () => {
    expect(predict([run(5), run(5)], 'run').basis).toBe('first');
    expect(predict([run(5), run(5), run(5)], 'run').basis).toBe('history');
  });

  /*
   * The property the whole mechanic depends on: the bar sits just past the
   * runner's normal. Above it, so beating it takes effort; not far above it,
   * so beating it is something that actually happens.
   */
  it('sets the bar just past the typical run', () => {
    const p = predict([run(4.3), run(4.1), run(4.6), run(4.4)], 'run');
    const typical = 4.35;
    expect(p.targetKm).toBeGreaterThanOrEqual(typical);
    expect(p.targetKm).toBeLessThanOrEqual(typical * 1.15 + 0.5);
  });

  /* One long Sunday run must not set a bar nobody reaches on a Tuesday. */
  it('ignores a single outlier', () => {
    const p = predict([run(5), run(5), run(5), run(5), run(21)], 'run');
    expect(p.targetKm).toBeLessThan(7);
  });

  it('only rounds to half kilometres', () => {
    [2.2, 3.7, 6.01, 9.9].forEach(km => {
      const p = predict([run(km), run(km), run(km)], 'run');
      expect((p.targetKm * 2) % 1).toBe(0);
    });
  });

  it('keeps runs and walks apart', () => {
    const history = [run(10), run(10), run(10), run(2, 'walk')];
    expect(predict(history, 'walk').basis).toBe('first');
    expect(predict(history, 'run').targetKm).toBeGreaterThanOrEqual(10);
  });

  it('uses only the most recent runs', () => {
    const old = [run(20), run(20), run(20), run(20)];
    const recent = [run(3), run(3), run(3), run(3), run(3), run(3)];
    expect(predict([...old, ...recent], 'run').targetKm).toBeLessThan(5);
  });
});

describe('judge', () => {
  const p: Prediction = { kind: 'run', targetKm: 5, basis: 'history', sample: 6 };

  it('beats the call at or past the target', () => {
    expect(judge(p, 5).beaten).toBe(true);
    expect(judge(p, 5.4)).toEqual({ beaten: true, marginKm: 0.4 });
  });

  it('misses short of it', () => {
    expect(judge(p, 4.3)).toEqual({ beaten: false, marginKm: 0.7 });
  });
});

describe('the copy', () => {
  const predictions: Prediction[] = [
    { kind: 'run', targetKm: 2, basis: 'first', sample: 0 },
    { kind: 'walk', targetKm: 3.5, basis: 'history', sample: 6 },
    { kind: 'run', targetKm: 10, basis: 'history', sample: 4 },
  ];
  const verdicts = [
    { beaten: true, marginKm: 0.4 },
    { beaten: true, marginKm: 0.03 },
    { beaten: false, marginKm: 1.2 },
    { beaten: false, marginKm: 0.25 },
  ];

  const everyLine = (): string[] =>
    TONES.flatMap(tone => [
      ...predictions.map(p => predictionLine(p, tone)),
      ...verdicts.map(v => verdictLine(v, tone)),
      passedLine('Vikram', 'Sunrise Runners', tone),
    ]);

  /*
   * The guardrail, enforced. Provocation aims at effort, never at the person.
   * Word boundaries, so "nobody" is not mistaken for "body".
   */
  it('never mentions bodies, weight or insults, in either voice', () => {
    everyLine().forEach(line => {
      NEVER_SAY.forEach(word => {
        expect(line.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
      });
    });
  });

  it('gives every jab a way to answer it', () => {
    // A prediction names a distance; a miss offers tomorrow; a pass offers a run.
    predictions.forEach(p =>
      TONES.forEach(tone => expect(predictionLine(p, tone)).toMatch(/km/)),
    );
    TONES.forEach(tone => {
      expect(verdictLine({ beaten: false, marginKm: 1 }, tone)).toMatch(/tomorrow/i);
    });
    expect(passedLine('V', 'C', 'warm')).toMatch(/run/i);
  });

  /* When they win, say so. That admission is the payoff. */
  it('admits defeat when the call is beaten', () => {
    expect(verdictLine({ beaten: true, marginKm: 0.5 }, 'savage')).toMatch(/we were wrong/i);
    expect(verdictLine({ beaten: true, marginKm: 0.5 }, 'warm')).toMatch(/you beat/i);
  });

  it('sounds different in each voice', () => {
    const p = predictions[2];
    expect(predictionLine(p, 'warm')).not.toBe(predictionLine(p, 'savage'));
  });

  it('reads margins the way people say them', () => {
    expect(verdictLine({ beaten: false, marginKm: 0.25 }, 'warm')).toContain('250 m');
    expect(verdictLine({ beaten: true, marginKm: 0.03 }, 'warm')).toContain('a whisker');
    expect(verdictLine({ beaten: false, marginKm: 1.2 }, 'warm')).toContain('1.2 km');
  });

  it('writes whole distances without a trailing .0', () => {
    expect(
      predictionLine({ kind: 'run', targetKm: 5, basis: 'history', sample: 6 }, 'warm'),
    ).toContain('5 km');
  });
});
