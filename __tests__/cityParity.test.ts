import { computeCity, stealPushLine, type CityRun } from '../src/services/city';
import { owners, stolenBy } from '../functions/src/city';
import { stealNudge } from '../functions/src/copy';

/**
 * The app draws the map; the server sends the steal alerts. Each carries its
 * own copy of the ownership rule, and these tests hold the two together.
 */

const NOW = Date.UTC(2026, 9, 20, 12);
const DAY = 24 * 60 * 60 * 1000;
const CLUBS = [
  ['owls', 'Night Owls'],
  ['hares', 'Hares'],
  ['larks', 'Larks'],
] as const;
const CELLS = ['a', 'b', 'c', 'd', 'e', 'f'];

function scenario(seed: number): CityRun[] {
  return Array.from({ length: (seed % 9) + 3 }, (_, i) => {
    const [clubId, clubName] = CLUBS[(seed + i * 2) % CLUBS.length];
    return {
      id: `r${seed}_${i}`,
      clubId,
      clubName,
      cells: CELLS.filter((_, k) => (seed + i + k) % 3 !== 0),
      // Spread over ten days, so some runs have aged out of the week.
      createdAtMs: NOW - ((seed * 3 + i * 7) % 10) * DAY - i * 1000,
    };
  });
}

describe('city ownership parity', () => {
  it('agrees with the app on every block, across 60 scenarios', () => {
    for (let s = 0; s < 60; s += 1) {
      const runs = scenario(s);
      const app = computeCity(runs, NOW).owned;
      const server = owners(runs, NOW);
      expect([...server.keys()].sort()).toEqual([...app.keys()].sort());
      server.forEach((o, cell) => expect(o.clubId).toBe(app.get(cell)!.clubId));
    }
  });

  it('reports a steal exactly when the app would show the block changing hands', () => {
    for (let s = 0; s < 60; s += 1) {
      const runs = scenario(s);
      const before = runs.slice(0, -1);
      const next = runs[runs.length - 1];
      const was = computeCity(before, NOW).owned;
      const is = computeCity(runs, NOW).owned;
      const expected = new Map<string, string[]>();
      new Set(next.cells).forEach(cell => {
        const a = was.get(cell);
        const b = is.get(cell);
        if (a && b && a.clubId !== next.clubId && b.clubId === next.clubId) {
          expected.set(a.clubId, [...(expected.get(a.clubId) ?? []), cell]);
        }
      });
      const got = stolenBy(before, next, NOW);
      expect([...got.keys()].sort()).toEqual([...expected.keys()].sort());
      got.forEach((v, club) => expect(v.cells.sort()).toEqual(expected.get(club)!.sort()));
    }
  });

  it('says the same thing in the push as in the app', () => {
    for (const savage of [true, false]) {
      for (const n of [1, 4]) {
        expect(stealNudge('Night Owls', 'Hares', n, savage ? 'savage' : 'warm').body).toBe(
          stealPushLine('Night Owls', 'Hares', n, savage),
        );
      }
    }
  });
});
