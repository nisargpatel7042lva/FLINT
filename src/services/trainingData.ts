import { FOCUS_LABEL, type Focus, type SessionLog } from './training';

/**
 * Personal training history fixtures.
 *
 * Deterministic, so streaks and stats are stable across reloads. Today is left
 * deliberately UNLOGGED: that puts the streak "at risk", which is the state
 * worth designing against — Char concerned, and a clear reason to open the app.
 */

/**
 * Local-date key. Deliberately NOT `toISOString()` — that converts to UTC, so
 * local midnight in any timezone ahead of UTC lands on the previous day. That
 * silently breaks consecutive-day comparison (every streak reads as 1) and
 * shifts calendar marks by a day.
 */
const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const shift = (base: Date, delta: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
};

const NOW = new Date();
export const TRAINING_TODAY = dayKey(NOW);

/* eslint-disable no-bitwise -- mulberry32 is defined in terms of bit ops. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

const FOCI: Focus[] = ['full', 'legs', 'upper', 'core', 'cardio'];

function buildHistory(): SessionLog[] {
  const rand = mulberry32(880419);
  const out: SessionLog[] = [];

  // 45 days back to yesterday. Today stays empty on purpose.
  for (let delta = -45; delta <= -1; delta += 1) {
    const day = dayKey(shift(NOW, delta));

    // The last six days are always present, so the demo has a live streak.
    const guaranteed = delta >= -6;
    if (!guaranteed && rand() < 0.42) {
      continue;
    }

    const focus = FOCI[Math.floor(rand() * FOCI.length)];
    const minutes = [5, 10, 15, 20, 30][Math.floor(rand() * 5)];
    const total = 6 + Math.floor(rand() * 9);
    const completed = rand() < 0.82 ? total : Math.max(2, total - Math.floor(rand() * 4));

    out.push({
      id: `log${out.length + 1}`,
      day,
      title: `${minutes}-minute ${FOCUS_LABEL[focus]}`,
      focus,
      minutes,
      completedSets: completed,
      totalSets: total,
      kcal: Math.round(minutes * (7 + rand() * 4)),
    });
  }

  return out.sort((a, b) => b.day.localeCompare(a.day));
}

export const SESSION_LOGS: SessionLog[] = buildHistory();

/** Newest first. */
export const recentLogs = (limit = 10): SessionLog[] => SESSION_LOGS.slice(0, limit);

export const logsByDay = (): Record<string, SessionLog> =>
  SESSION_LOGS.reduce<Record<string, SessionLog>>((acc, l) => {
    acc[l.day] = l;
    return acc;
  }, {});

/** The user's own profile for the personal loop. */
export const PROFILE = {
  name: 'Nisarg',
  handle: '@nisarg',
  joinedDay: dayKey(shift(NOW, -46)),
};
