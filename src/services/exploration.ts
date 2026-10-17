import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeoPoint, Segment } from './location';

/**
 * Explored ground.
 *
 * The world is divided into fixed cells. Any cell a track passes through is
 * uncovered for good, so a run stops being "5km" and becomes "five blocks I
 * had never set foot in". The point of the feature is the second number: it
 * rewards going somewhere new rather than going further.
 *
 * WHAT THIS IS NOT: a map. Street tiles need a keyed provider that bills per
 * view, so what gets drawn is the SHAPE of where you have been — a grid of
 * uncovered squares. People recognise their own city in it surprisingly
 * quickly, and a real basemap can slot underneath later without this module
 * changing.
 */

/**
 * Cell size.
 *
 * 120m is tuned to the walk-to-run range this app covers. Much larger and a
 * single 5km run swallows the neighbourhood in one go, so nothing is left to
 * find; much smaller and a good session barely colours anything in, which
 * reads as no progress. At 120m a 5km route uncovers roughly 40 cells.
 */
export const TILE_METRES = 120;

/** Metres per degree of latitude. Constant enough everywhere for a game grid. */
const METRES_PER_DEG_LAT = 111_320;

const LAT_STEP = TILE_METRES / METRES_PER_DEG_LAT;

/** `"row:col"`. Compact, stable, and readable in a debugger. */
export type CellId = string;

/**
 * Longitude step for a given row.
 *
 * A degree of longitude shrinks toward the poles, so a fixed degree step would
 * make cells progressively narrower the further north you go — 120m tall and
 * 60m wide in Norway. Scaling the step by latitude keeps cells roughly square
 * wherever somebody is running.
 *
 * The scale is taken from the middle of the row's whole-degree BAND, not from
 * the row itself. Column boundaries are `col × step`, and with a column index
 * in the tens of thousands even a tiny difference in step between neighbouring
 * rows shifts their boundaries by a large fraction of a block — the grid comes
 * out staggered like brickwork, and "blocks" stop lining up with each other.
 * One step per band keeps the columns straight for ~111 km at a time; inside a
 * band the width varies by under 1%.
 */
function lonStepForRow(row: number): number {
  const bandLat = Math.floor((row + 0.5) * LAT_STEP) + 0.5;
  const cos = Math.cos((bandLat * Math.PI) / 180);
  // Guard the poles, where cos approaches zero and the step would explode.
  return LAT_STEP / Math.max(cos, 0.01);
}

export const rowFor = (lat: number): number => Math.floor(lat / LAT_STEP);

export function cellFor(lat: number, lon: number): CellId {
  const row = rowFor(lat);
  const col = Math.floor(lon / lonStepForRow(row));
  return `${row}:${col}`;
}

/** Latitude/longitude bounds of a cell — used to draw it. */
export function cellBounds(id: CellId): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const [rowRaw, colRaw] = id.split(':');
  const row = Number(rowRaw);
  const col = Number(colRaw);
  const lonStep = lonStepForRow(row);

  return {
    minLat: row * LAT_STEP,
    maxLat: (row + 1) * LAT_STEP,
    minLon: col * lonStep,
    maxLon: (col + 1) * lonStep,
  };
}

/**
 * Every cell a track touched.
 *
 * Points are sampled every few seconds, and at running pace that is roughly
 * every 15–30m — comfortably inside a 120m cell, so consecutive fixes cannot
 * skip one. Cycling at 30km/h covers ~90m between fixes, still inside a cell.
 * Only a vehicle would outrun the sampling, and this app does not track those.
 */
export function cellsForTrack(segments: Segment[]): Set<CellId> {
  const cells = new Set<CellId>();
  segments.forEach(points =>
    points.forEach((p: GeoPoint) => cells.add(cellFor(p.latitude, p.longitude))),
  );
  return cells;
}

// ── Persistence ────────────────────────────────────────────────────────────

/** Cell id → number of separate sessions that touched it. */
export type ExploredCells = Record<CellId, number>;

// v2: the grid's columns changed (see lonStepForRow); v1 ids no longer line up.
const KEY = 'kasrat.exploration.v2';

/**
 * Upper bound on stored cells.
 *
 * At 120m, 20,000 cells is roughly 290 km² — far past what anyone covers on
 * foot, and it keeps the stored blob near 300KB. Hitting it means something is
 * wrong (a GPS fault scattering points), not that somebody explored too much.
 */
const MAX_CELLS = 20_000;

export async function loadExplored(): Promise<ExploredCells> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: ExploredCells = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, visits]) => {
      if (/^-?\d+:-?\d+$/.test(id) && typeof visits === 'number' && visits > 0) {
        out[id] = visits;
      }
    });
    return out;
  } catch {
    // Losing the map is a shame, not a reason to fail to open the app.
    return {};
  }
}

export async function saveExplored(cells: ExploredCells): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cells));
  } catch {
    // Fire and forget.
  }
}

export const resetExplored = () => AsyncStorage.removeItem(KEY).catch(() => {});

export type TrackExploration = {
  /** Cells this track uncovered for the first time. The number that matters. */
  discovered: CellId[];
  /** Cells revisited. Shown as ground held, not as failure. */
  revisited: CellId[];
  next: ExploredCells;
};

/** Merges a finished track into the map. Pure — the caller persists `next`. */
export function recordTrack(
  explored: ExploredCells,
  segments: Segment[],
): TrackExploration {
  const touched = cellsForTrack(segments);
  const next: ExploredCells = { ...explored };
  const discovered: CellId[] = [];
  const revisited: CellId[] = [];

  touched.forEach(id => {
    if (next[id]) {
      next[id] += 1;
      revisited.push(id);
    } else if (Object.keys(next).length < MAX_CELLS) {
      next[id] = 1;
      discovered.push(id);
    }
  });

  return { discovered, revisited, next };
}

// ── What it adds up to ─────────────────────────────────────────────────────

/** Square metres of one cell, near enough for a headline figure. */
const CELL_AREA_KM2 = (TILE_METRES / 1000) ** 2;

export const areaKm2 = (cells: ExploredCells): number =>
  Math.round(Object.keys(cells).length * CELL_AREA_KM2 * 100) / 100;

/**
 * The unexplored cells touching explored ones.
 *
 * This is the motivating number, and the reason the feature exists. Total area
 * rewards whoever already lives somewhere interesting; the frontier says "there
 * are 46 blocks you have never set foot in, and they start at the end of your
 * street". It shrinks only by going somewhere new, and it grows as you do —
 * which is the honest shape of exploring.
 */
export function frontier(cells: ExploredCells): CellId[] {
  const explored = new Set(Object.keys(cells));
  const edge = new Set<CellId>();

  explored.forEach(id => {
    const [row, col] = id.split(':').map(Number);
    [
      `${row + 1}:${col}`,
      `${row - 1}:${col}`,
      `${row}:${col + 1}`,
      `${row}:${col - 1}`,
    ].forEach(neighbour => {
      if (!explored.has(neighbour)) {
        edge.add(neighbour);
      }
    });
  });

  return [...edge];
}

export type ExplorerRank = {
  name: string;
  /** Cells needed to reach it. */
  from: number;
  blurb: string;
};

/**
 * Ranks, in Spark's voice.
 *
 * Deliberately not achievements-with-badges. Each one names what you have
 * actually done, and the thresholds are spaced so the first two arrive in the
 * first week — a ladder whose bottom rung is out of reach motivates nobody.
 */
export const EXPLORER_RANKS: ExplorerRank[] = [
  { name: 'Doorstep', from: 0, blurb: 'Everyone starts at their own front door.' },
  { name: 'Local', from: 25, blurb: 'You know your own streets now.' },
  { name: 'Wanderer', from: 100, blurb: 'You have started going the long way round.' },
  { name: 'Explorer', from: 300, blurb: 'You are covering real ground.' },
  { name: 'Cartographer', from: 800, blurb: 'You could draw this place from memory.' },
  { name: 'Pathfinder', from: 2000, blurb: 'You have run out of nearby unknowns.' },
];

export const rankFor = (cellCount: number): ExplorerRank =>
  [...EXPLORER_RANKS].reverse().find(r => cellCount >= r.from) ?? EXPLORER_RANKS[0];

export const nextRank = (cellCount: number): ExplorerRank | null =>
  EXPLORER_RANKS.find(r => r.from > cellCount) ?? null;

/**
 * Copy for the end of a session.
 *
 * Never scolds a repeat route. Somebody running their usual loop is still
 * running, and the whole product rule is that Spark invites rather than
 * accuses — a nudge to go further has to sound like an opportunity.
 */
export function explorationSummary(discovered: number, revisited: number): string {
  if (discovered === 0 && revisited === 0) {
    return 'No ground logged — GPS never got a fix.';
  }
  if (discovered === 0) {
    return 'Familiar ground today. It still counts.';
  }
  if (discovered === 1) {
    return 'One new block on the map.';
  }
  if (discovered >= revisited) {
    return `${discovered} new blocks — most of that route was new ground.`;
  }
  return `${discovered} new blocks added to your map.`;
}
