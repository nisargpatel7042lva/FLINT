import {
  CITY_WINDOW_DAYS,
  MAX_CITY_CELLS,
  NEVER_SAY,
  cellFor,
  cityCellsForRun,
  clubColour,
  computeCity,
  regionFor,
  runsToTake,
  snapshotOf,
  standings,
  stealLine,
  stealsSince,
  takeLine,
  type CityRun,
} from '../src/services';
import type { GeoPoint } from '../src/services/location';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 17, 12);

let seq = 0;
const run = (
  clubId: string,
  cells: string[],
  daysAgo: number,
  clubName = clubId,
): CityRun => {
  seq += 1;
  return {
    id: `u${seq}_${seq}_${clubId}`,
    uid: `u${seq}`,
    clubId,
    clubName,
    cells,
    createdAtMs: NOW - daysAgo * DAY + seq,
  };
};

/** A straight line north, one point every ~11 m. */
function line(km: number): GeoPoint[] {
  const n = Math.round(km * 90);
  return Array.from({ length: n + 1 }, (_, i) => ({
    latitude: 22.3 + i * 0.0001,
    longitude: 73.18,
    timestamp: i * 4000,
    accuracy: 5,
  }));
}

describe('cityCellsForRun', () => {
  it('never lights the block a run starts or ends in', () => {
    const pts = line(2);
    const cells = cityCellsForRun([pts]);
    const start = cellFor(pts[0].latitude, pts[0].longitude);
    const end = cellFor(pts[pts.length - 1].latitude, pts[pts.length - 1].longitude);
    expect(cells).not.toContain(start);
    expect(cells).not.toContain(end);
    // ~2 km minus 400 m of trim, at 120 m blocks.
    expect(cells.length).toBeGreaterThanOrEqual(12);
    expect(cells.length).toBeLessThanOrEqual(15);
  });

  it('trims across a pause at the front gate', () => {
    const pts = line(1.5);
    // Paused after 50 m, then carried on.
    const cells = cityCellsForRun([pts.slice(0, 5), pts.slice(5)]);
    expect(cells).not.toContain(cellFor(pts[0].latitude, pts[0].longitude));
  });

  it('lights nothing on a run shorter than the two trims', () => {
    expect(cityCellsForRun([line(0.35)])).toEqual([]);
  });

  it('caps the blocks one run can light', () => {
    // A zig-zag across many columns, far more than the cap.
    const pts: GeoPoint[] = [];
    for (let i = 0; i < 6000; i += 1) {
      pts.push({
        latitude: 22.3 + (i % 2) * 0.0012,
        longitude: 73.18 + i * 0.0012,
        timestamp: i * 4000,
        accuracy: 5,
      });
    }
    expect(cityCellsForRun([pts]).length).toBe(MAX_CITY_CELLS);
  });
});

describe('computeCity', () => {
  it('gives a block to the club with the most runs through it', () => {
    const state = computeCity(
      [run('owls', ['a'], 2), run('owls', ['a'], 1), run('hares', ['a'], 0.5)],
      NOW,
    );
    expect(state.owned.get('a')?.clubId).toBe('owls');
    expect(state.owned.get('a')?.runs).toBe(2);
    expect(state.owned.get('a')?.counts).toEqual({ owls: 2, hares: 1 });
  });

  it('leaves a tie with whoever got there first', () => {
    const state = computeCity([run('owls', ['a'], 3), run('hares', ['a'], 1)], NOW);
    expect(state.owned.get('a')?.clubId).toBe('owls');
  });

  it('hands a block over the moment a challenger goes ahead', () => {
    const state = computeCity(
      [run('owls', ['a'], 3), run('hares', ['a'], 2), run('hares', ['a'], 1)],
      NOW,
    );
    expect(state.owned.get('a')?.clubId).toBe('hares');
  });

  it('counts a run through the same block twice as one run', () => {
    const state = computeCity(
      [run('owls', ['a'], 2), run('hares', ['a', 'a', 'a'], 1)],
      NOW,
    );
    expect(state.owned.get('a')?.clubId).toBe('owls');
  });

  it('burns a block out after a week, and keeps it as an ember for another', () => {
    const state = computeCity(
      [run('owls', ['old'], CITY_WINDOW_DAYS + 1), run('owls', ['ancient'], 20)],
      NOW,
    );
    expect(state.owned.has('old')).toBe(false);
    expect(state.embers.has('old')).toBe(true);
    expect(state.embers.has('ancient')).toBe(false);
  });

  it('does not call a block an ember while it is still lit', () => {
    const state = computeCity(
      [run('owls', ['a'], CITY_WINDOW_DAYS + 2), run('hares', ['a'], 1)],
      NOW,
    );
    expect(state.embers.has('a')).toBe(false);
    expect(state.owned.get('a')?.clubId).toBe('hares');
  });

  it('ignores runs from the future', () => {
    const state = computeCity([run('owls', ['a'], -1)], NOW);
    expect(state.owned.size).toBe(0);
  });
});

describe('runsToTake', () => {
  it('is one more than the gap', () => {
    const state = computeCity(
      [run('owls', ['a'], 3), run('owls', ['a'], 2), run('owls', ['a'], 1), run('hares', ['a'], 1)],
      NOW,
    );
    const block = state.owned.get('a')!;
    expect(runsToTake(block, 'hares')).toBe(3);
    expect(runsToTake(block, 'newcomers')).toBe(4);
    expect(runsToTake(block, 'owls')).toBe(0);
  });
});

describe('standings', () => {
  it('ranks clubs by blocks held', () => {
    const state = computeCity(
      [run('owls', ['a', 'b', 'c'], 1, 'Night Owls'), run('hares', ['d'], 1, 'Hares')],
      NOW,
    );
    expect(standings(state)).toEqual([
      { clubId: 'owls', clubName: 'Night Owls', blocks: 3 },
      { clubId: 'hares', clubName: 'Hares', blocks: 1 },
    ]);
  });
});

describe('stealsSince', () => {
  it('reports blocks another club took, grouped by who took them', () => {
    const before = snapshotOf(computeCity([run('mine', ['a', 'b', 'c'], 2)], NOW));
    const now = computeCity(
      [
        run('mine', ['a', 'b', 'c'], 2),
        run('owls', ['a', 'b'], 1, 'Night Owls'),
        run('owls', ['a', 'b'], 1, 'Night Owls'),
        run('hares', ['c'], 1, 'Hares'),
        run('hares', ['c'], 1, 'Hares'),
      ],
      NOW,
    );
    const steals = stealsSince(before, now, ['mine']);
    expect(steals.map(s => [s.byClubName, s.cells.length])).toEqual([
      ['Night Owls', 2],
      ['Hares', 1],
    ]);
  });

  it('does not call a burnt-out block a steal', () => {
    const before = { a: 'mine' };
    expect(stealsSince(before, computeCity([], NOW), ['mine'])).toEqual([]);
  });

  it('does not report a block moving between two of my own clubs', () => {
    const before = { a: 'mine' };
    const now = computeCity([run('alsoMine', ['a'], 1)], NOW);
    expect(stealsSince(before, now, ['mine', 'alsoMine'])).toEqual([]);
  });
});

describe('regions and colours', () => {
  it('puts nearby runs in one region', () => {
    expect(regionFor(22.30, 73.18)).toBe(regionFor(22.32, 73.2));
  });

  it('gives a club the same colour every time', () => {
    expect(clubColour('abc')).toBe(clubColour('abc'));
    expect(clubColour('abc')).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('copy', () => {
  const block = computeCity(
    [run('owls', ['a'], 2, 'Night Owls'), run('owls', ['a'], 1, 'Night Owls')],
    NOW,
  ).owned.get('a')!;

  it('tells a challenger exactly what it takes', () => {
    expect(takeLine(block, 'hares')).toBe(
      'Night Owls holds it with 2. 3 more runs from your club takes it.',
    );
    expect(takeLine(block, 'owls')).toBe('Yours. 2 runs through it this week.');
  });

  it('never says anything on the never-say list', () => {
    const lines = [
      stealLine({ byClubId: 'o', byClubName: 'Owls', cells: ['a'] }, true),
      stealLine({ byClubId: 'o', byClubName: 'Owls', cells: ['a', 'b'] }, false),
      takeLine(block, null),
      takeLine(block, 'hares'),
    ];
    lines.forEach(l =>
      NEVER_SAY.forEach(word => expect(l.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`))),
    );
  });
});
