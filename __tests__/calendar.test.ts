import { columnOf, monthGrid } from '../src/components/MonthCalendar';

/** Monday-first column labels, matching the header row. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

describe('columnOf', () => {
  it('puts Monday first and Sunday last', () => {
    // 2026-08-31 is a Monday, 2026-08-02 a Sunday.
    expect(columnOf(new Date(2026, 7, 31))).toBe(0);
    expect(columnOf(new Date(2026, 7, 2))).toBe(6);
  });

  it('covers all seven columns across a week', () => {
    const columns = Array.from({ length: 7 }, (_, i) =>
      columnOf(new Date(2026, 7, 3 + i)),
    );
    expect(columns).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('monthGrid', () => {
  /*
   * THE regression.
   *
   * The grid was a flat list in a `flexWrap` row with cells at `100/7`% —
   * 14.285714…%, which rounds to fractionally over 100% for seven, so the
   * seventh wrapped. Six date columns rendered under seven weekday headers and
   * every date after the 1st sat under the wrong day: in August 2026, Sunday
   * the 2nd appeared beneath Monday.
   *
   * Weeks of exactly seven make that structural rather than a layout accident.
   */
  it('always returns whole weeks of seven', () => {
    for (let year = 2024; year <= 2030; year += 1) {
      for (let m = 0; m < 12; m += 1) {
        monthGrid(new Date(year, m, 1)).forEach(week => {
          expect(week).toHaveLength(7);
        });
      }
    }
  });

  it('places every date under its real weekday', () => {
    // The invariant that was broken: a date's column must equal its weekday.
    for (let year = 2024; year <= 2030; year += 1) {
      for (let m = 0; m < 12; m += 1) {
        monthGrid(new Date(year, m, 1)).forEach(week => {
          week.forEach((date, column) => {
            if (date) {
              expect(columnOf(date)).toBe(column);
            }
          });
        });
      }
    }
  });

  it('lays August 2026 out the way a wall calendar does', () => {
    const weeks = monthGrid(new Date(2026, 7, 1));
    const shown = weeks.map(w => w.map(d => d?.getDate() ?? null));

    // 1 August 2026 is a Saturday, so the first week is five blanks, then 1,
    // then Sunday the 2nd — NOT 1 alone followed by 2 under Monday.
    expect(shown[0]).toEqual([null, null, null, null, null, 1, 2]);
    expect(shown[1]).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(shown[shown.length - 1]).toEqual([31, null, null, null, null, null, null]);
  });

  it('starts a month that begins on a Monday with no padding', () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid(new Date(2026, 5, 1))[0][0]?.getDate()).toBe(1);
  });

  it('handles a month that begins on a Sunday', () => {
    // 1 February 2026 is a Sunday: six blanks, then the 1st in the last column.
    const first = monthGrid(new Date(2026, 1, 1))[0];
    expect(first.slice(0, 6).every(d => d === null)).toBe(true);
    expect(first[6]?.getDate()).toBe(1);
  });

  it('includes every day of the month exactly once', () => {
    for (let m = 0; m < 12; m += 1) {
      const month = new Date(2026, m, 1);
      const daysInMonth = new Date(2026, m + 1, 0).getDate();
      const dates = monthGrid(month)
        .flat()
        .filter((d): d is Date => d !== null)
        .map(d => d.getDate());

      expect(dates).toHaveLength(daysInMonth);
      expect(new Set(dates).size).toBe(daysInMonth);
      expect(dates[0]).toBe(1);
      expect(dates[dates.length - 1]).toBe(daysInMonth);
    }
  });

  it('handles a leap February', () => {
    const dates = monthGrid(new Date(2028, 1, 1))
      .flat()
      .filter((d): d is Date => d !== null);
    expect(dates).toHaveLength(29);
  });

  it('never spills into a neighbouring month', () => {
    monthGrid(new Date(2026, 7, 1))
      .flat()
      .filter((d): d is Date => d !== null)
      .forEach(d => expect(d.getMonth()).toBe(7));
  });

  it('agrees with the header row it is drawn under', () => {
    // The headers are a fixed 7-column row; the grid must use the same order.
    const weeks = monthGrid(new Date(2026, 7, 1));
    weeks.forEach(week =>
      week.forEach((date, column) => {
        if (date) {
          const expected = WEEKDAYS[column];
          const actual = WEEKDAYS[columnOf(date)];
          expect(actual).toBe(expected);
        }
      }),
    );
  });
});
