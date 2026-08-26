import type { DailyPoint, RetentionPoint, StreakBucket } from '../lib/analytics';

/**
 * Charts, hand-drawn as inline SVG.
 *
 * No charting library: these are three fixed shapes, and a dependency would add
 * more bundle and more API surface than the ~120 lines here. Every chart states
 * its own axis bounds, because an unlabelled axis is how a flat line gets
 * presented as growth.
 */

const ACCENT = '#e2560b';
const LINE = '#e2e0dd';
const FAINT = '#8a8a8a';

/** Daily participation, as bars. Incomplete days are drawn hollow. */
export function DailyBars({ points }: { points: DailyPoint[] }) {
  const width = 640;
  const height = 180;
  const padLeft = 34;
  const padBottom = 22;
  const usableW = width - padLeft - 8;
  const usableH = height - padBottom - 10;

  const barW = Math.max(usableW / Math.max(points.length, 1) - 3, 3);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img"
      aria-label="Daily participation percentage">
      {[0, 25, 50, 75, 100].map(v => {
        const y = 10 + usableH - (v / 100) * usableH;
        return (
          <g key={v}>
            <line x1={padLeft} y1={y} x2={width - 8} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={0} y={y + 4} fontSize={10} fill={FAINT}>
              {v}%
            </text>
          </g>
        );
      })}

      {points.map((p, i) => {
        const h = (p.completionPct / 100) * usableH;
        const x = padLeft + i * (usableW / Math.max(points.length, 1));
        const y = 10 + usableH - h;
        return (
          <rect
            key={p.day}
            x={x}
            y={y}
            width={barW}
            height={Math.max(h, 1)}
            rx={2}
            fill={p.complete ? ACCENT : 'none'}
            stroke={p.complete ? 'none' : ACCENT}
            strokeDasharray={p.complete ? undefined : '2 2'}
          />
        );
      })}

      {points.map((p, i) =>
        p.dayNumber === 1 || p.dayNumber % 5 === 0 ? (
          <text
            key={`l${p.day}`}
            x={padLeft + i * (usableW / Math.max(points.length, 1))}
            y={height - 6}
            fontSize={10}
            fill={FAINT}>
            {p.dayNumber}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Retention of the day-1 cohort, as a line. */
export function RetentionLine({ points }: { points: RetentionPoint[] }) {
  const width = 640;
  const height = 180;
  const padLeft = 34;
  const padBottom = 22;
  const usableW = width - padLeft - 8;
  const usableH = height - padBottom - 10;

  if (points.length === 0) {
    return <p className="faint">No day-1 cohort to measure yet.</p>;
  }

  const xFor = (i: number) =>
    padLeft + (i / Math.max(points.length - 1, 1)) * usableW;
  const yFor = (pct: number) => 10 + usableH - (pct / 100) * usableH;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.retainedPct)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img"
      aria-label="Retention of the day one cohort">
      {[0, 25, 50, 75, 100].map(v => {
        const y = yFor(v);
        return (
          <g key={v}>
            <line x1={padLeft} y1={y} x2={width - 8} y2={y} stroke={LINE} strokeWidth={1} />
            <text x={0} y={y + 4} fontSize={10} fill={FAINT}>
              {v}%
            </text>
          </g>
        );
      })}

      <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />
      {points.map((p, i) =>
        i === 0 || i === points.length - 1 ? (
          <circle key={p.dayNumber} cx={xFor(i)} cy={yFor(p.retainedPct)} r={3.5} fill={ACCENT} />
        ) : null,
      )}

      {points.map((p, i) =>
        p.dayNumber === 1 || p.dayNumber % 5 === 0 ? (
          <text key={`l${p.dayNumber}`} x={xFor(i)} y={height - 6} fontSize={10} fill={FAINT}>
            {p.dayNumber}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Streak distribution, as a horizontal bar per bucket. */
export function StreakBars({ buckets }: { buckets: StreakBucket[] }) {
  const max = Math.max(...buckets.map(b => b.students), 1);

  return (
    <table>
      <tbody>
        {buckets.map(b => (
          <tr key={b.label}>
            <td style={{ width: 150 }}>{b.label}</td>
            <td>
              <div
                style={{
                  height: 14,
                  borderRadius: 3,
                  background: ACCENT,
                  width: `${(b.students / max) * 100}%`,
                  minWidth: b.students > 0 ? 4 : 0,
                }}
              />
            </td>
            <td className="num" style={{ width: 110 }}>
              {b.students} <span className="faint">({b.pct}%)</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
