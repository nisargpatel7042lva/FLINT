import { useMemo } from 'react';

import { DailyBars, RetentionLine, StreakBars } from '../components/Charts';
import {
  dailySeries,
  retentionCurve,
  streakDistribution,
  summarise,
  toCsv,
} from '../lib/analytics';
import type { Challenge, DailyLog, Student } from '../lib/types';

function Metric({
  value,
  label,
  note,
  accent = false,
}: {
  value: string;
  label: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="panel">
      <div className={`metric-value${accent ? ' accent' : ''}`}>{value}</div>
      <div className="metric-label">{label}</div>
      {note ? <div className="metric-note">{note}</div> : null}
    </div>
  );
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Dashboard({
  challenge,
  students,
  logs,
  today,
  onOpenSummary,
  onOpenInvite,
}: {
  challenge: Challenge;
  students: Student[];
  logs: DailyLog[];
  today: string;
  onOpenSummary: () => void;
  onOpenInvite: () => void;
}) {
  const series = useMemo(
    () => dailySeries(challenge, students, logs, today),
    [challenge, students, logs, today],
  );
  const retention = useMemo(
    () => retentionCurve(challenge, logs, today),
    [challenge, logs, today],
  );
  const streaks = useMemo(
    () => streakDistribution(students, logs, today),
    [students, logs, today],
  );
  const summary = useMemo(
    () => summarise(challenge, students, logs, today),
    [challenge, students, logs, today],
  );

  const played = series.filter(p => p.complete);

  return (
    <div className="shell">
      <div className="row" style={{ marginBottom: 6 }}>
        <div>
          <h1>{challenge.name}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Day {summary.daysElapsed} of {summary.daysTotal} · {challenge.startDay} to{' '}
            {challenge.endDay}
          </p>
        </div>
        <div className="spacer" />
        <button onClick={onOpenInvite}>Invite students</button>
        <button className="primary" onClick={onOpenSummary}>
          Summary for reporting
        </button>
      </div>

      <h2 className="section-title">Headline</h2>
      <div className="grid cols-4">
        <Metric value={`${summary.enrolled}`} label="Students enrolled" />
        <Metric
          value={`${summary.everActivePct}%`}
          label="Took part at least once"
          note={`${summary.everActive} of ${summary.enrolled} students`}
          accent
        />
        <Metric
          value={`${summary.avgCompletionPct}%`}
          label="Average daily participation"
          note="Mean across completed days"
        />
        <Metric
          value={`${summary.medianActiveDays}`}
          label="Median days trained"
          note="Per enrolled student"
        />
      </div>

      <h2 className="section-title">Daily participation</h2>
      <div className="panel">
        <p className="faint" style={{ marginBottom: 14 }}>
          Share of enrolled students who logged at least one session that day.
          Today is still in progress and is drawn hollow.
        </p>
        <DailyBars points={series} />
        <div className="row" style={{ marginTop: 14 }}>
          <span className="faint">
            Day 1: <strong>{summary.day1Pct}%</strong> · Latest completed day:{' '}
            <strong>{summary.latestPct}%</strong>
          </span>
          <div className="spacer" />
          <button
            className="no-print"
            onClick={() => download(`${challenge.id}-daily.csv`, toCsv(series))}>
            Download CSV
          </button>
        </div>
      </div>

      <h2 className="section-title">Retention</h2>
      <div className="panel">
        <p className="faint" style={{ marginBottom: 14 }}>
          Of the <strong>{retention.cohortSize}</strong> students who started on
          day 1, the share still training on each later day. This is stricter
          than daily participation above, which also counts students who joined
          later — the two are not interchangeable.
        </p>
        <RetentionLine points={retention.points} />
      </div>

      <h2 className="section-title">Current streaks</h2>
      <div className="panel">
        <p className="faint" style={{ marginBottom: 14 }}>
          How many consecutive days each student has trained, as of today. Shown
          as a distribution rather than an average, because a handful of long
          streaks pulls a mean up and hides that most students are at zero.
        </p>
        <StreakBars buckets={streaks} />
      </div>

      <h2 className="section-title">Average time logged</h2>
      <div className="panel">
        <p className="faint" style={{ marginBottom: 14 }}>
          Two different questions. Among students who trained, sessions stay
          roughly the same length all programme. Across everyone enrolled, the
          average falls as participation falls — that second number is the one
          that reflects the programme's real reach.
        </p>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th className="num">Avg minutes (participants)</th>
              <th className="num">Avg minutes (all enrolled)</th>
              <th className="num">Participation</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map(w => {
              const slice = played.slice(w * 7, w * 7 + 7);
              if (slice.length === 0) {
                return null;
              }
              const mean = (get: (p: (typeof slice)[number]) => number) =>
                Math.round((slice.reduce((n, p) => n + get(p), 0) / slice.length) * 10) /
                10;
              return (
                <tr key={w}>
                  <td>Week {w + 1}</td>
                  <td className="num">{mean(p => p.avgMinutesActive)}</td>
                  <td className="num">{mean(p => p.avgMinutesEnrolled)}</td>
                  <td className="num">{mean(p => p.completionPct)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
