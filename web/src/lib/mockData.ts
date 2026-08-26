import type { Challenge, College, DailyLog, Student } from './types';

/**
 * Fixtures for a 30-day college challenge.
 *
 * Deliberately NOT a flattering dataset. Participation decays the way real
 * programmes do — a strong first week, a slump after it, weekend dips — because
 * a dashboard tuned against perfect data hides exactly the problems a
 * coordinator needs to see. If the charts only look right on a good cohort,
 * they are decoration.
 */

/* eslint-disable no-bitwise */
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

/** Day 22 of 30 — mid-programme, which is when a coordinator actually looks. */
const START = shift(NOW, -21);
const END = shift(START, 29);

export const TODAY = dayKey(NOW);

export const COLLEGE: College = {
  id: 'clg1',
  name: 'SVIT Vasad',
  coordinatorEmail: 'wellness@svitvasad.ac.in',
};

export const CHALLENGE: Challenge = {
  id: 'ch1',
  collegeId: COLLEGE.id,
  name: '30-Day Campus Fitness Challenge',
  startDay: dayKey(START),
  endDay: dayKey(END),
  joinCode: 'VTAK34', // valid under the shared no-lookalike alphabet
};

const ENROLLED = 124;

export const STUDENTS: Student[] = Array.from({ length: ENROLLED }, (_, i) => ({
  id: `s${i + 1}`,
  name: `Student ${i + 1}`,
  enrolledDay: CHALLENGE.startDay,
}));

/**
 * Students who enrol and never log anything.
 *
 * Roughly a fifth, which is realistic — people join a campus programme and
 * never start. Without them "took part at least once" comes out at 100%, which
 * is not a metric, it is a rounding artefact. The activation rate only means
 * something if it can be below 100.
 */
const NEVER_ACTIVATES = new Set(
  STUDENTS.filter((_, i) => i % 5 === 3).map(s => s.id),
);

/**
 * Per-day participation probability.
 *
 * Shaped rather than random: a high first week while novelty carries, a sharp
 * drop through week two, then a slow decline. Weekends dip. This is the curve
 * the product is trying to flatten, so the dashboard has to be able to show it.
 */
function participationRate(dayIndex: number, date: Date): number {
  const base =
    dayIndex < 3
      ? 0.78 - dayIndex * 0.03
      : dayIndex < 10
      ? 0.7 - (dayIndex - 3) * 0.035
      : 0.46 - (dayIndex - 10) * 0.006;

  const weekend = date.getDay() === 0 || date.getDay() === 6;
  return Math.max(base * (weekend ? 0.72 : 1), 0.08);
}

function buildLogs(): DailyLog[] {
  const rand = mulberry32(770423);
  const out: DailyLog[] = [];

  for (let i = 0; i < 30; i += 1) {
    const date = shift(START, i);
    const day = dayKey(date);
    if (day > TODAY) {
      break; // the programme has not reached these days yet
    }

    const rate = participationRate(i, date);

    for (const student of STUDENTS) {
      if (NEVER_ACTIVATES.has(student.id)) {
        continue;
      }

      // Give each student a persistent commitment level, so the same people
      // tend to keep showing up — retention is about individuals, not dice.
      const commitment = 0.55 + (Number(student.id.slice(1)) % 100) / 140;
      if (rand() > rate * commitment) {
        continue;
      }

      out.push({
        studentId: student.id,
        day,
        minutes: [5, 10, 15, 20, 30][Math.floor(rand() * 5)],
      });
    }
  }

  return out;
}

export const LOGS: DailyLog[] = buildLogs();
