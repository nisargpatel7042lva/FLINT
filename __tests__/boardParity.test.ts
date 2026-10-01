import * as app from '../src/services/clubBoard';
import { passedLine, TONES } from '../src/services/ego';
import * as server from '../functions/src/board';
import { passedNudge } from '../functions/src/copy';

/**
 * The app and the Cloud Function each carry the club board, because the
 * functions package cannot import from the app. Two copies of ranking logic
 * drift — and when they do, the push says you were passed for second while
 * the app shows you third. These tests run the same fixtures through both.
 */

let n = 0;
const run = (uid: string, km: number, day: string, hour = 6): app.ClubRun => {
  n += 1;
  return {
    id: `${uid}_${n}`,
    uid,
    kind: 'run',
    distanceKm: km,
    durationSec: km * 360,
    day,
    createdAt: `${day}T${String(hour).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}:00.000Z`,
  };
};

const DAYS = ['2026-09-27', '2026-09-28', '2026-09-30', '2026-10-01', '2026-10-04'];
const PEOPLE = ['ana', 'vikram', 'me', 'priya', 'rohan'];

/** A deterministic spread of club weeks, including ties and last week's runs. */
function scenarios(): { before: app.ClubRun[]; next: app.ClubRun }[] {
  const out: { before: app.ClubRun[]; next: app.ClubRun }[] = [];
  for (let s = 0; s < 40; s += 1) {
    const before = Array.from({ length: (s % 7) + 1 }, (_, i) =>
      run(PEOPLE[(s + i) % PEOPLE.length], ((s * 7 + i * 3) % 12) + 0.5, DAYS[(s + i) % DAYS.length]),
    );
    out.push({
      before,
      next: run(PEOPLE[s % PEOPLE.length], ((s * 5) % 9) + 1, DAYS[(s + 2) % DAYS.length], 9),
    });
  }
  return out;
}

describe('board parity between app and server', () => {
  it('agrees on the week start for every day', () => {
    DAYS.forEach(d => expect(server.weekStartKey(d)).toBe(app.weekStartKey(d)));
  });

  it('agrees on who every run overtook', () => {
    scenarios().forEach(({ before, next }) => {
      const week = app.weekStartKey(next.day);
      expect(server.overtakenBy(before, next, week).sort()).toEqual(
        app.overtakenBy(before, next, week).sort(),
      );
    });
  });

  it('actually exercises overtakes, not just empty results', () => {
    const hits = scenarios().filter(({ before, next }) => {
      const week = app.weekStartKey(next.day);
      return app.overtakenBy(before, next, week).length > 0;
    });
    expect(hits.length).toBeGreaterThan(5);
  });
});

describe('push parity', () => {
  /* The push and the banner are the same moment seen twice. */
  it('says exactly what the in-app banner says, in both voices', () => {
    TONES.forEach(tone => {
      expect(passedNudge('Vikram', 'Sunrise Runners', tone).body).toBe(
        passedLine('Vikram', 'Sunrise Runners', tone),
      );
    });
  });
});
