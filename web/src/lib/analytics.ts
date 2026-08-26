import type { Challenge, DailyLog, Student } from './types';

/**
 * Programme analytics.
 *
 * Every number a coordinator shows to a budget holder is computed here, and
 * every one carries an explicit definition. That matters more than the charts:
 * "60% completion" means nothing until you say completion *of what*, *out of
 * whom*. Ambiguous metrics are how programmes get defunded when someone checks.
 *
 * PRIVACY: everything below aggregates. The dashboard never exposes an
 * individual student's training detail — a wellness coordinator needs to know
 * whether the programme works, not who skipped leg day.
 */

/**
 * Local-date key, `YYYY-MM-DD`.
 *
 * NEVER use toISOString() for a day key. It converts to UTC first, so at any
 * positive offset (IST is +5:30) local midnight lands on the PREVIOUS calendar
 * day and every key silently shifts. The app writes local-date keys, so the
 * dashboard has to read them the same way or nothing joins — which is exactly
 * what happened here: day 1 reported 0% participation on a cohort that had
 * trained, because the two sides disagreed about what "day 1" was called.
 */
const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const dayList = (challenge: Challenge): string[] => {
  const out: string[] = [];
  const cursor = new Date(`${challenge.startDay}T00:00:00`);
  const end = new Date(`${challenge.endDay}T00:00:00`);
  while (cursor <= end) {
    out.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/** Day index (1-based) for labelling — "Day 1" reads better than a date. */
export const dayNumber = (challenge: Challenge, day: string): number =>
  dayList(challenge).indexOf(day) + 1;

export type DailyPoint = {
  day: string;
  dayNumber: number;
  /** Distinct students who logged anything that day. */
  activeStudents: number;
  /** activeStudents / enrolled, as a percentage. */
  completionPct: number;
  /** Mean minutes among students who trained. Excludes non-participants. */
  avgMinutesActive: number;
  /** Mean minutes across ALL enrolled, counting non-participants as zero. */
  avgMinutesEnrolled: number;
  /** True once the day is in the past — partial days skew the curve. */
  complete: boolean;
};

/**
 * Per-day series.
 *
 * Two averages are reported on purpose. "Average time logged" is ambiguous:
 * among people who showed up it stays flat and flattering; across everyone
 * enrolled it falls as participation falls. A coordinator presenting only the
 * first will be caught out, so the dashboard shows both and labels them.
 */
export function dailySeries(
  challenge: Challenge,
  students: Student[],
  logs: DailyLog[],
  today: string,
): DailyPoint[] {
  const enrolled = students.length || 1;
  const byDay = new Map<string, DailyLog[]>();

  for (const log of logs) {
    const list = byDay.get(log.day);
    if (list) {
      list.push(log);
    } else {
      byDay.set(log.day, [log]);
    }
  }

  return dayList(challenge).map((day, i) => {
    const dayLogs = byDay.get(day) ?? [];
    const distinct = new Set(dayLogs.map(l => l.studentId));
    const totalMinutes = dayLogs.reduce((n, l) => n + l.minutes, 0);
    const active = distinct.size;

    return {
      day,
      dayNumber: i + 1,
      activeStudents: active,
      completionPct: Math.round((active / enrolled) * 1000) / 10,
      avgMinutesActive: active > 0 ? Math.round(totalMinutes / active) : 0,
      avgMinutesEnrolled: Math.round((totalMinutes / enrolled) * 10) / 10,
      complete: day < today,
    };
  });
}

export type RetentionPoint = {
  dayNumber: number;
  /** Of the day-1 starters, the share still active on this day. */
  retainedPct: number;
  retainedCount: number;
};

/**
 * Retention curve — day 1 cohort only.
 *
 * This is the strict definition: of the students who actually started on day 1,
 * how many are still training on day N. It is NOT the same as daily
 * participation, which can look healthier because it counts late joiners.
 * Both are shown in the UI, separately labelled, because conflating them is the
 * most common way engagement numbers mislead.
 */
export function retentionCurve(
  challenge: Challenge,
  logs: DailyLog[],
  today: string,
): { points: RetentionPoint[]; cohortSize: number } {
  const days = dayList(challenge);
  const firstDay = days[0];

  const cohort = new Set(
    logs.filter(l => l.day === firstDay).map(l => l.studentId),
  );
  const cohortSize = cohort.size;

  if (cohortSize === 0) {
    return { points: [], cohortSize: 0 };
  }

  const points = days
    .filter(d => d < today)
    .map((day, i) => {
      const activeFromCohort = new Set(
        logs
          .filter(l => l.day === day && cohort.has(l.studentId))
          .map(l => l.studentId),
      );
      return {
        dayNumber: i + 1,
        retainedCount: activeFromCohort.size,
        retainedPct: Math.round((activeFromCohort.size / cohortSize) * 1000) / 10,
      };
    });

  return { points, cohortSize };
}

export type StreakBucket = { label: string; students: number; pct: number };

/**
 * Current-streak distribution.
 *
 * Buckets rather than a mean, because streaks are heavily skewed: a handful of
 * 20-day streaks drags an average up and hides that most students are at zero.
 * The distribution is the honest shape.
 */
export function streakDistribution(
  students: Student[],
  logs: DailyLog[],
  today: string,
): StreakBucket[] {
  const byStudent = new Map<string, Set<string>>();
  for (const log of logs) {
    const set = byStudent.get(log.studentId) ?? new Set<string>();
    set.add(log.day);
    byStudent.set(log.studentId, set);
  }

  const shift = (d: Date, delta: number) => {
    const n = new Date(d);
    n.setDate(n.getDate() + delta);
    return n;
  };
  const key = dayKey;

  const streakOf = (days: Set<string>): number => {
    const start = new Date(`${today}T00:00:00`);
    // A streak stays alive until midnight, so today not being logged yet does
    // not break it — same rule the student app uses.
    let cursor = days.has(today) ? start : shift(start, -1);
    if (!days.has(key(cursor))) {
      return 0;
    }
    let n = 0;
    while (days.has(key(cursor))) {
      n += 1;
      cursor = shift(cursor, -1);
    }
    return n;
  };

  const buckets: { label: string; min: number; max: number }[] = [
    { label: 'No active streak', min: 0, max: 0 },
    { label: '1–2 days', min: 1, max: 2 },
    { label: '3–6 days', min: 3, max: 6 },
    { label: '7–13 days', min: 7, max: 13 },
    { label: '14+ days', min: 14, max: Infinity },
  ];

  const counts = buckets.map(() => 0);
  for (const s of students) {
    const streak = streakOf(byStudent.get(s.id) ?? new Set());
    const idx = buckets.findIndex(b => streak >= b.min && streak <= b.max);
    counts[idx >= 0 ? idx : 0] += 1;
  }

  const total = students.length || 1;
  return buckets.map((b, i) => ({
    label: b.label,
    students: counts[i],
    pct: Math.round((counts[i] / total) * 1000) / 10,
  }));
}

export type Summary = {
  enrolled: number;
  /** Ever logged at least once — the activation rate. */
  everActive: number;
  everActivePct: number;
  /** Median distinct days trained per enrolled student. */
  medianActiveDays: number;
  totalMinutes: number;
  totalSessions: number;
  avgCompletionPct: number;
  day1Pct: number;
  latestPct: number;
  daysElapsed: number;
  daysTotal: number;
};

/** The handful of numbers that go on the exportable one-pager. */
export function summarise(
  challenge: Challenge,
  students: Student[],
  logs: DailyLog[],
  today: string,
): Summary {
  const series = dailySeries(challenge, students, logs, today).filter(p => p.complete);
  const days = dayList(challenge);

  const perStudentDays = new Map<string, Set<string>>();
  for (const l of logs) {
    const set = perStudentDays.get(l.studentId) ?? new Set<string>();
    set.add(l.day);
    perStudentDays.set(l.studentId, set);
  }

  const activeDayCounts = students.map(
    s => perStudentDays.get(s.id)?.size ?? 0,
  );
  const sorted = [...activeDayCounts].sort((a, b) => a - b);
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);

  const everActive = activeDayCounts.filter(n => n > 0).length;
  const enrolled = students.length;

  return {
    enrolled,
    everActive,
    everActivePct: enrolled ? Math.round((everActive / enrolled) * 1000) / 10 : 0,
    medianActiveDays: median,
    totalMinutes: logs.reduce((n, l) => n + l.minutes, 0),
    totalSessions: logs.length,
    avgCompletionPct: series.length
      ? Math.round(
          (series.reduce((n, p) => n + p.completionPct, 0) / series.length) * 10,
        ) / 10
      : 0,
    day1Pct: series[0]?.completionPct ?? 0,
    latestPct: series[series.length - 1]?.completionPct ?? 0,
    daysElapsed: series.length,
    daysTotal: days.length,
  };
}

/** CSV for the coordinator's own spreadsheet. */
export function toCsv(points: DailyPoint[]): string {
  const header =
    'day,day_number,active_students,completion_pct,avg_minutes_active,avg_minutes_enrolled';
  const rows = points.map(p =>
    [
      p.day,
      p.dayNumber,
      p.activeStudents,
      p.completionPct,
      p.avgMinutesActive,
      p.avgMinutesEnrolled,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
