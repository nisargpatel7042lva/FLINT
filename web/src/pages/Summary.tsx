import { useMemo } from 'react';

import { DailyBars } from '../components/Charts';
import {
  dailySeries,
  retentionCurve,
  streakDistribution,
  summarise,
} from '../lib/analytics';
import type { Challenge, College, DailyLog, Student } from '../lib/types';

/**
 * The one-pager a coordinator puts in front of whoever holds the budget.
 *
 * Designed to be printed or screenshotted: no navigation, no interaction, and
 * every number stated with the definition it was computed under. A figure a
 * coordinator cannot explain when challenged is worse than no figure.
 *
 * It deliberately reports the weak numbers alongside the strong ones. A summary
 * that only survives friendly questions is not evidence.
 */
export function Summary({
  college,
  challenge,
  students,
  logs,
  today,
  onBack,
}: {
  college: College;
  challenge: Challenge;
  students: Student[];
  logs: DailyLog[];
  today: string;
  onBack: () => void;
}) {
  const series = useMemo(
    () => dailySeries(challenge, students, logs, today),
    [challenge, students, logs, today],
  );
  const summary = useMemo(
    () => summarise(challenge, students, logs, today),
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

  const activeStreaks = streaks
    .filter(b => b.label !== 'No active streak')
    .reduce((n, b) => n + b.students, 0);

  const lastRetention = retention.points[retention.points.length - 1];
  const hours = Math.round(summary.totalMinutes / 60);

  return (
    <div className="shell">
      <div className="row no-print" style={{ marginBottom: 20 }}>
        <button onClick={onBack}>← Back to dashboard</button>
        <div className="spacer" />
        <button className="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="panel">
        <p className="faint">{college.name} · Wellness programme report</p>
        <h1 style={{ marginTop: 6 }}>{challenge.name}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {challenge.startDay} to {challenge.endDay} · reporting on day{' '}
          {summary.daysElapsed} of {summary.daysTotal} · generated {today}
        </p>

        <h2 className="section-title">What the programme delivered</h2>
        <div className="grid cols-3">
          <div>
            <div className="metric-value accent">{summary.everActive}</div>
            <div className="metric-label">Students who took part</div>
            <div className="metric-note">
              {summary.everActivePct}% of {summary.enrolled} enrolled logged at
              least one session.
            </div>
          </div>
          <div>
            <div className="metric-value accent">{summary.totalSessions}</div>
            <div className="metric-label">Sessions completed</div>
            <div className="metric-note">
              {hours} hours of physical activity across the cohort.
            </div>
          </div>
          <div>
            <div className="metric-value accent">{activeStreaks}</div>
            <div className="metric-label">Students on an active streak</div>
            <div className="metric-note">
              Training on consecutive days as of {today}.
            </div>
          </div>
        </div>

        <h2 className="section-title">Participation over time</h2>
        <DailyBars points={series} />
        <p className="faint" style={{ marginTop: 10 }}>
          Share of enrolled students training each day. Day 1 {summary.day1Pct}%,
          most recent completed day {summary.latestPct}%.
        </p>

        <h2 className="section-title">How to read these numbers</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ width: 220 }}>
                <strong>Took part at least once</strong>
              </td>
              <td>
                {summary.everActivePct}% — the share of enrolled students who
                logged any session. Measures reach, not habit.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Average daily participation</strong>
              </td>
              <td>
                {summary.avgCompletionPct}% — mean across completed days. Counts
                everyone enrolled in the denominator, including students who
                never started.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Median days trained</strong>
              </td>
              <td>
                {summary.medianActiveDays} days per enrolled student. Median, not
                mean, so a few very committed students do not inflate it.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Day-1 cohort retention</strong>
              </td>
              <td>
                {lastRetention
                  ? `${lastRetention.retainedPct}% of the ${retention.cohortSize} students who started on day 1 were still training on day ${lastRetention.dayNumber}.`
                  : 'Not enough completed days to report yet.'}{' '}
                Stricter than daily participation, which also counts later
                joiners.
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="section-title">Caveats</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
          <li>
            Participation is self-logged in the app. It is not independently
            verified for individual training.
          </li>
          <li>
            The programme is {summary.daysElapsed} of {summary.daysTotal} days
            in; figures will move before it ends.
          </li>
          <li>
            {streaks[0].students} of {summary.enrolled} students (
            {streaks[0].pct}%) have no active streak today.
          </li>
        </ul>

        <p className="faint" style={{ marginTop: 24 }}>
          Generated by Kasrat for {college.name}. Contact{' '}
          {college.coordinatorEmail}.
        </p>
      </div>
    </div>
  );
}
