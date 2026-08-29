import {
  EXPLORER_RANKS,
  TILE_METRES,
  areaKm2,
  cellBounds,
  cellFor,
  cellsForTrack,
  explorationSummary,
  frontier,
  loadExplored,
  nextRank,
  rankFor,
  recordTrack,
  saveExplored,
  type ExploredCells,
} from '../src/services/exploration';
import { haversineKm, type GeoPoint } from '../src/services/location';

/** Gujarat, where the first users are. */
const LAT = 22.47;
const LON = 72.93;

const at = (lat: number, lon: number, t = 0): GeoPoint => ({
  latitude: lat,
  longitude: lon,
  timestamp: 1_700_000_000_000 + t * 1000,
  accuracy: 5,
});

describe('cell grid', () => {
  it('puts a point and itself in the same cell', () => {
    expect(cellFor(LAT, LON)).toBe(cellFor(LAT, LON));
  });

  it('keeps nearby points together and distant points apart', () => {
    // 20m north — same cell. 500m north — a different one.
    expect(cellFor(LAT + 0.00018, LON)).toBe(cellFor(LAT, LON));
    expect(cellFor(LAT + 0.0045, LON)).not.toBe(cellFor(LAT, LON));
  });

  /*
   * The property that matters: cells must be roughly square and roughly
   * TILE_METRES across, at every latitude somebody might run. A fixed degree
   * step for longitude would pass at the equator and produce cells half as
   * wide as they are tall in northern Europe.
   */
  it('stays roughly square from the equator to the arctic', () => {
    [0, 22.47, 45, 60, 71].forEach(lat => {
      const { minLat, maxLat, minLon, maxLon } = cellBounds(cellFor(lat, 10));

      const heightM =
        haversineKm(at(minLat, minLon), at(maxLat, minLon)) * 1000;
      const widthM = haversineKm(at(minLat, minLon), at(minLat, maxLon)) * 1000;

      expect(heightM).toBeGreaterThan(TILE_METRES * 0.9);
      expect(heightM).toBeLessThan(TILE_METRES * 1.1);
      // Width is allowed more slack: a cell spans a range of latitudes, so it
      // cannot be exactly square at both its top and bottom edge.
      expect(widthM).toBeGreaterThan(TILE_METRES * 0.75);
      expect(widthM).toBeLessThan(TILE_METRES * 1.25);
    });
  });

  it('agrees on columns for two points side by side in the same row', () => {
    // Same row, a metre apart in latitude. If the longitude step were derived
    // from each point's own latitude rather than the row's, these could land
    // in different columns.
    const a = cellFor(LAT, LON);
    const b = cellFor(LAT + 0.000005, LON);
    expect(a).toBe(b);
  });

  it('round-trips a cell through its bounds', () => {
    const id = cellFor(LAT, LON);
    const { minLat, maxLat, minLon, maxLon } = cellBounds(id);

    expect(LAT).toBeGreaterThanOrEqual(minLat);
    expect(LAT).toBeLessThan(maxLat);
    expect(LON).toBeGreaterThanOrEqual(minLon);
    expect(LON).toBeLessThan(maxLon);

    // The centre of the cell resolves back to the same cell.
    expect(cellFor((minLat + maxLat) / 2, (minLon + maxLon) / 2)).toBe(id);
  });

  it('handles the southern and western hemispheres', () => {
    expect(cellFor(-33.86, 151.2)).toMatch(/^-?\d+:-?\d+$/);
    expect(cellFor(40.71, -74.0)).toMatch(/^-?\d+:-?\d+$/);
    // Opposite hemispheres must never collide.
    expect(cellFor(-33.86, 151.2)).not.toBe(cellFor(33.86, 151.2));
  });
});

describe('cellsForTrack', () => {
  it('collects every cell a route passes through', () => {
    // ~1km north: should cross several cells at 120m each.
    const points = Array.from({ length: 40 }, (_, i) =>
      at(LAT + i * 0.000225, LON, i * 5),
    );
    const cells = cellsForTrack([points]);

    expect(cells.size).toBeGreaterThan(5);
    expect(cells.size).toBeLessThan(15);
  });

  it('does not skip cells at running sample rates', () => {
    // A fix every 5s at 4 m/s is 20m of travel — well inside a 120m cell, so
    // consecutive points must land in the same or an adjacent cell.
    const points = Array.from({ length: 60 }, (_, i) =>
      at(LAT + i * 0.00018, LON, i * 5),
    );
    const rows = [...cellsForTrack([points])].map(id => Number(id.split(':')[0]));
    const sorted = [...rows].sort((a, b) => a - b);

    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i] - sorted[i - 1]).toBe(1);
    }
  });

  it('handles an empty track', () => {
    expect(cellsForTrack([]).size).toBe(0);
    expect(cellsForTrack([[]]).size).toBe(0);
  });
});

describe('recordTrack', () => {
  const track = [[at(LAT, LON), at(LAT + 0.0005, LON), at(LAT + 0.001, LON)]];

  it('counts every cell as new the first time', () => {
    const { discovered, revisited, next } = recordTrack({}, track);
    expect(discovered.length).toBeGreaterThan(0);
    expect(revisited).toHaveLength(0);
    expect(Object.keys(next)).toHaveLength(discovered.length);
  });

  it('counts the same route as revisited the second time', () => {
    const first = recordTrack({}, track);
    const second = recordTrack(first.next, track);

    expect(second.discovered).toHaveLength(0);
    expect(second.revisited.length).toBe(first.discovered.length);
    // Visit counts accumulate rather than the cell being added twice.
    expect(Object.keys(second.next)).toHaveLength(Object.keys(first.next).length);
    Object.values(second.next).forEach(v => expect(v).toBe(2));
  });

  it('reports only the new part of a partly-new route', () => {
    const first = recordTrack({}, track);
    const longer = [
      [...track[0], at(LAT + 0.002, LON), at(LAT + 0.003, LON)],
    ];
    const second = recordTrack(first.next, longer);

    expect(second.discovered.length).toBeGreaterThan(0);
    expect(second.revisited.length).toBeGreaterThan(0);
  });

  it('never mutates the map it was given', () => {
    const before: ExploredCells = {};
    recordTrack(before, track);
    expect(Object.keys(before)).toHaveLength(0);
  });
});

describe('frontier', () => {
  /*
   * The frontier is the motivating number: unexplored ground touching explored
   * ground. It has to grow as you explore, not shrink — otherwise the feature
   * would tell people they are running out of places to go.
   */
  it('rings a single explored cell with four neighbours', () => {
    expect(frontier({ '100:200': 1 })).toHaveLength(4);
  });

  it('excludes cells that are already explored', () => {
    const edge = frontier({ '100:200': 1, '100:201': 1 });
    expect(edge).not.toContain('100:200');
    expect(edge).not.toContain('100:201');
    // Two adjacent cells share a boundary, so the ring is 6, not 8.
    expect(edge).toHaveLength(6);
  });

  it('grows as more ground is covered', () => {
    const small = frontier({ '100:200': 1 });
    const larger = frontier({ '100:200': 1, '100:201': 1, '101:200': 1 });
    expect(larger.length).toBeGreaterThan(small.length);
  });

  it('is empty for an empty map', () => {
    expect(frontier({})).toHaveLength(0);
  });
});

describe('area', () => {
  it('reports the ground covered', () => {
    // 100 cells at 120m square = 1.44 km².
    const cells: ExploredCells = {};
    for (let i = 0; i < 100; i += 1) {
      cells[`0:${i}`] = 1;
    }
    expect(areaKm2(cells)).toBeCloseTo(1.44, 2);
  });

  it('is zero for an empty map', () => {
    expect(areaKm2({})).toBe(0);
  });
});

describe('ranks', () => {
  it('starts everyone on the bottom rung', () => {
    expect(rankFor(0).name).toBe('Doorstep');
  });

  it('climbs with ground covered', () => {
    expect(rankFor(30).name).toBe('Local');
    expect(rankFor(500).name).toBe('Explorer');
    expect(rankFor(100000).name).toBe('Pathfinder');
  });

  it('always has a next rank until the top', () => {
    expect(nextRank(0)?.name).toBe('Local');
    expect(nextRank(100000)).toBeNull();
  });

  it('puts the first two ranks within a first week of running', () => {
    // A 5km route uncovers ~40 cells, so Local should land after one or two
    // sessions. A ladder whose bottom rung is out of reach motivates nobody.
    expect(EXPLORER_RANKS[1].from).toBeLessThanOrEqual(50);
  });
});

describe('explorationSummary', () => {
  it('never scolds a repeated route', () => {
    const text = explorationSummary(0, 30).toLowerCase();
    expect(text).toContain('still counts');
    ['again', 'same old', 'boring', 'nothing new'].forEach(word =>
      expect(text).not.toContain(word),
    );
  });

  it('leads with the new ground', () => {
    expect(explorationSummary(12, 4)).toContain('12');
  });

  it('says something honest when GPS never worked', () => {
    expect(explorationSummary(0, 0)).toContain('never got a fix');
  });

  it('handles the singular', () => {
    expect(explorationSummary(1, 0)).toBe('One new block on the map.');
  });
});

describe('persistence', () => {
  it('round-trips a map', async () => {
    await saveExplored({ '10:20': 3, '10:21': 1 });
    expect(await loadExplored()).toEqual({ '10:20': 3, '10:21': 1 });
  });

  it('drops entries that are not cells', async () => {
    await saveExplored({
      '10:20': 1,
      nonsense: 4,
      '11:22': 0,
    } as unknown as ExploredCells);

    const loaded = await loadExplored();
    expect(loaded).toEqual({ '10:20': 1 });
  });
});
