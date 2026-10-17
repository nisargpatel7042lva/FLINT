import { cellFor, type CellId } from './exploration';
import { haversineKm, type GeoPoint, type Segment } from './location';

/**
 * Light up the city.
 *
 * Every club run lights the ~120 m blocks it passes through in the club's
 * colour. Over a rolling seven days, the club with the most member-runs
 * through a block owns it. A block nobody runs for seven days burns out.
 *
 * The rules are deliberately tiny, because they have to fit in one sentence on
 * a club WhatsApp group: "most runs through it this week owns it". Anything
 * cleverer (distance-weighted, pace-weighted) would be argued about rather
 * than run for.
 *
 * Everything here is pure, so the same rules can run on the phone today and
 * in a Cloud Function later without the two disagreeing.
 */

/** How long a run keeps counting toward a block. */
export const CITY_WINDOW_DAYS = 7;
/**
 * How long a burnt-out block keeps glowing as an ember.
 *
 * A block that went dark is an invitation — somebody's ground is up for grabs
 * — so it stays visible for a second week rather than vanishing.
 */
export const EMBER_WINDOW_DAYS = 14;

/**
 * Distance cut from both ends of every run before it lights anything.
 *
 * Most runs start and end at home. Without this, the first and last block of
 * every route — public to everyone in the city — would point at the runner's
 * front door. 200 m is about two blocks: enough to blur a doorstep into a
 * neighbourhood.
 */
export const PRIVACY_TRIM_KM = 0.2;

/** Cells one run may light. ~48 km of new ground; mirrored in the rules. */
export const MAX_CITY_CELLS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CityRun = {
  id: string;
  uid: string;
  clubId: string;
  clubName: string;
  cells: CellId[];
  createdAtMs: number;
};

export type BlockOwner = {
  cell: CellId;
  clubId: string;
  clubName: string;
  /** The owner's runs through this block in the window. */
  runs: number;
  /** Every club's runs through it, so a challenger can see the gap. */
  counts: Record<string, number>;
  /** Most recent run through it, by anyone. */
  lastRunMs: number;
};

export type CityState = {
  owned: Map<CellId, BlockOwner>;
  /** Lit last week, dark this week. */
  embers: Set<CellId>;
};

// ── Which blocks a run lights ──────────────────────────────────────────────

/**
 * The blocks a run lights, with both ends trimmed for privacy.
 *
 * Trimmed by distance along the route, across pauses, so a run that pauses at
 * the front gate and resumes still has its first 200 m removed.
 */
export function cityCellsForRun(segments: Segment[]): CellId[] {
  const points: GeoPoint[] = [];
  const along: number[] = [];
  let total = 0;
  segments.forEach(seg =>
    seg.forEach((p, i) => {
      if (i > 0) {
        total += haversineKm(seg[i - 1], p);
      }
      points.push(p);
      along.push(total);
    }),
  );

  const cells = new Set<CellId>();
  points.forEach((p, i) => {
    if (along[i] >= PRIVACY_TRIM_KM && along[i] <= total - PRIVACY_TRIM_KM) {
      cells.add(cellFor(p.latitude, p.longitude));
    }
  });
  return [...cells].slice(0, MAX_CITY_CELLS);
}

/**
 * The region a run belongs to: a ~28 km square.
 *
 * The map only loads its own region's runs. Without this, opening the map in
 * Vadodara would download every run in the country.
 */
const REGION_DEG = 0.25;
export function regionFor(lat: number, lon: number): string {
  return `${Math.floor(lat / REGION_DEG)}:${Math.floor(lon / REGION_DEG)}`;
}

/** The region of a run, from where its middle is. */
export function regionForRun(segments: Segment[]): string | null {
  const points = segments.flat();
  if (points.length === 0) {
    return null;
  }
  const mid = points[Math.floor(points.length / 2)];
  return regionFor(mid.latitude, mid.longitude);
}

// ── Ownership ──────────────────────────────────────────────────────────────

/**
 * Who owns what, right now.
 *
 * Runs are replayed in order, and a block changes hands only when a challenger
 * goes strictly ahead. So a tie stays with whoever got there first — the club
 * that has to come and take a block has to actually out-run the one holding it.
 */
export function computeCity(runs: CityRun[], now: number): CityState {
  const since = now - CITY_WINDOW_DAYS * DAY_MS;
  const emberSince = now - EMBER_WINDOW_DAYS * DAY_MS;

  const owned = new Map<CellId, BlockOwner>();
  const recentlyLit = new Set<CellId>();

  [...runs]
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .forEach(run => {
      if (run.createdAtMs < emberSince || run.createdAtMs > now) {
        return;
      }
      if (run.createdAtMs < since) {
        run.cells.forEach(c => recentlyLit.add(c));
        return;
      }
      // A run through the same block twice is one run through it.
      new Set(run.cells).forEach(cell => {
        const block = owned.get(cell);
        if (!block) {
          owned.set(cell, {
            cell,
            clubId: run.clubId,
            clubName: run.clubName,
            runs: 1,
            counts: { [run.clubId]: 1 },
            lastRunMs: run.createdAtMs,
          });
          return;
        }
        const mine = (block.counts[run.clubId] ?? 0) + 1;
        block.counts[run.clubId] = mine;
        block.lastRunMs = run.createdAtMs;
        if (run.clubId === block.clubId) {
          block.runs = mine;
          block.clubName = run.clubName;
        } else if (mine > block.runs) {
          block.clubId = run.clubId;
          block.clubName = run.clubName;
          block.runs = mine;
        }
      });
    });

  const embers = new Set<CellId>();
  recentlyLit.forEach(c => {
    if (!owned.has(c)) {
      embers.add(c);
    }
  });
  return { owned, embers };
}

/** How many more runs `clubId` needs through a block to take it. */
export function runsToTake(block: BlockOwner, clubId: string): number {
  if (block.clubId === clubId) {
    return 0;
  }
  return block.runs - (block.counts[clubId] ?? 0) + 1;
}

export type Standing = { clubId: string; clubName: string; blocks: number };

/** Clubs by blocks held, most first. */
export function standings(state: CityState): Standing[] {
  const by = new Map<string, Standing>();
  state.owned.forEach(b => {
    const s = by.get(b.clubId) ?? { clubId: b.clubId, clubName: b.clubName, blocks: 0 };
    s.blocks += 1;
    by.set(b.clubId, s);
  });
  return [...by.values()].sort(
    (a, b) => b.blocks - a.blocks || a.clubName.localeCompare(b.clubName),
  );
}

// ── Steals ─────────────────────────────────────────────────────────────────

/** Block → owning club id. What we remember between visits. */
export type OwnershipSnapshot = Record<CellId, string>;

export function snapshotOf(state: CityState): OwnershipSnapshot {
  const out: OwnershipSnapshot = {};
  state.owned.forEach((b, cell) => {
    out[cell] = b.clubId;
  });
  return out;
}

export type Steal = { byClubId: string; byClubName: string; cells: CellId[] };

/**
 * Blocks one of my clubs held last time I looked and another club holds now.
 *
 * Grouped by thief, biggest first, because "Night Owls took 6 of your blocks"
 * lands; six separate one-block alerts are noise. Blocks that merely burnt out
 * are not steals — nobody took them, they were let go.
 */
export function stealsSince(
  before: OwnershipSnapshot,
  now: CityState,
  myClubIds: string[],
): Steal[] {
  const mine = new Set(myClubIds);
  const by = new Map<string, Steal>();
  Object.entries(before).forEach(([cell, clubId]) => {
    if (!mine.has(clubId)) {
      return;
    }
    const block = now.owned.get(cell);
    if (!block || mine.has(block.clubId)) {
      return;
    }
    const s = by.get(block.clubId) ?? {
      byClubId: block.clubId,
      byClubName: block.clubName,
      cells: [],
    };
    s.cells.push(cell);
    by.set(block.clubId, s);
  });
  return [...by.values()].sort((a, b) => b.cells.length - a.cells.length);
}

// ── Colour ─────────────────────────────────────────────────────────────────

/**
 * Each club's colour, derived from its id.
 *
 * Derived rather than chosen so it needs no field on the club, no migration,
 * and every phone agrees without asking. Bright on purpose: these are drawn
 * as light on a dark map.
 */
export const CLUB_COLOURS = [
  '#FF6B1A',
  '#22D3EE',
  '#A3E635',
  '#F472B6',
  '#FACC15',
  '#818CF8',
  '#34D399',
  '#FB7185',
] as const;

export function clubColour(clubId: string): string {
  let h = 0;
  for (let i = 0; i < clubId.length; i += 1) {
    h = (h * 31 + clubId.charCodeAt(i)) % 2_147_483_647;
  }
  return CLUB_COLOURS[Math.abs(h) % CLUB_COLOURS.length];
}

// ── Copy ───────────────────────────────────────────────────────────────────

export function stealLine(s: Steal, savage: boolean): string {
  const n = s.cells.length;
  const blocks = n === 1 ? 'a block' : `${n} blocks`;
  return savage
    ? `${s.byClubName} took ${blocks} off you. Going to let that stand?`
    : `${s.byClubName} took ${blocks} from your club. Run through ${
        n === 1 ? 'it' : 'them'
      } to win ${n === 1 ? 'it' : 'them'} back.`;
}

export function takeLine(block: BlockOwner, myClubId: string | null): string {
  if (!myClubId) {
    return `${block.clubName} owns this block with ${block.runs} run${block.runs === 1 ? '' : 's'} this week.`;
  }
  if (block.clubId === myClubId) {
    return `Yours. ${block.runs} run${block.runs === 1 ? '' : 's'} through it this week.`;
  }
  const need = runsToTake(block, myClubId);
  return `${block.clubName} holds it with ${block.runs}. ${need} more run${
    need === 1 ? '' : 's'
  } from your club takes it.`;
}
