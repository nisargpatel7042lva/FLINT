/**
 * Block ownership — SERVER copy of the rules in `src/services/city.ts`.
 *
 * The functions package cannot import from the app, so the rule lives twice.
 * `__tests__/cityParity.test.ts` runs the same runs through both and fails if
 * they ever disagree about who owns a block — a steal alert for a block the
 * app still shows as yours would be worse than no alert at all.
 *
 * The rule: over the last 7 days, the club with the most runs through a block
 * owns it; a challenger has to go strictly ahead, so ties stay with the club
 * that got there first. A run through the same block twice counts once.
 */

export type CityRunLite = {
  id: string;
  clubId: string;
  clubName: string;
  cells: string[];
  createdAtMs: number;
};

export type Owner = { clubId: string; clubName: string; runs: number; counts: Record<string, number> };

const DAY_MS = 24 * 60 * 60 * 1000;
export const CITY_WINDOW_DAYS = 7;

export function owners(runs: CityRunLite[], now: number): Map<string, Owner> {
  const since = now - CITY_WINDOW_DAYS * DAY_MS;
  const out = new Map<string, Owner>();
  [...runs]
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .forEach(run => {
      if (run.createdAtMs < since || run.createdAtMs > now) {
        return;
      }
      new Set(run.cells).forEach(cell => {
        const block = out.get(cell);
        if (!block) {
          out.set(cell, {
            clubId: run.clubId,
            clubName: run.clubName,
            runs: 1,
            counts: { [run.clubId]: 1 },
          });
          return;
        }
        const mine = (block.counts[run.clubId] ?? 0) + 1;
        block.counts[run.clubId] = mine;
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
  return out;
}

/**
 * Which clubs just lost blocks to `next`, and how many each.
 *
 * Compares ownership of the new run's own cells with and without it — only
 * those cells can change hands.
 */
export function stolenBy(
  before: CityRunLite[],
  next: CityRunLite,
  now: number,
): Map<string, { clubName: string; cells: string[] }> {
  const was = owners(before, now);
  const is = owners([...before, next], now);
  const lost = new Map<string, { clubName: string; cells: string[] }>();
  new Set(next.cells).forEach(cell => {
    const a = was.get(cell);
    const b = is.get(cell);
    if (a && b && a.clubId !== next.clubId && b.clubId === next.clubId) {
      const entry = lost.get(a.clubId) ?? { clubName: a.clubName, cells: [] };
      entry.cells.push(cell);
      lost.set(a.clubId, entry);
    }
  });
  return lost;
}
