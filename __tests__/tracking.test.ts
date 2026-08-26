import {
  createAccumulator,
  formatDuration,
  formatPace,
  haversineKm,
  summarise,
  type GeoPoint,
} from '../src/services/location';

/**
 * A degree of latitude is ~111.19km everywhere, so walking north in fixed
 * latitude steps gives a route whose length is known without trusting the
 * function under test to tell us.
 */
const KM_PER_DEG_LAT = 111.195;

const START = 1_700_000_000_000;

/** `steps` points heading north, one every `secondsPerStep`. */
function leg(
  steps: number,
  degPerStep: number,
  secondsPerStep: number,
  startLat = 0,
  startTime = START,
): GeoPoint[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    latitude: startLat + i * degPerStep,
    longitude: 0,
    timestamp: startTime + i * secondsPerStep * 1000,
    accuracy: 5,
  }));
}

describe('haversineKm', () => {
  it('measures a degree of latitude', () => {
    const km = haversineKm(
      { latitude: 0, longitude: 0, timestamp: 0, accuracy: null },
      { latitude: 1, longitude: 0, timestamp: 0, accuracy: null },
    );
    expect(km).toBeCloseTo(KM_PER_DEG_LAT, 1);
  });
});

describe('summarise', () => {
  it('accumulates distance along a segment', () => {
    // 10 steps of 0.001deg = 0.01deg ~= 1.112km
    const summary = summarise([leg(10, 0.001, 10)]);
    expect(summary.distanceKm).toBeCloseTo(1.11, 1);
    expect(summary.movingSeconds).toBe(100);
  });

  it('never counts the gap between segments', () => {
    // Two 1.112km legs, the second starting 5 degrees (~556km) further north.
    // A naive flat list would add that jump to the total.
    const first = leg(10, 0.001, 10);
    const second = leg(10, 0.001, 10, 5, START + 600_000);

    const joined = summarise([[...first, ...second]]);
    const paused = summarise([first, second]);

    expect(joined.distanceKm).toBeGreaterThan(500);
    expect(paused.distanceKm).toBeCloseTo(2.22, 1);
  });

  it('excludes paused time from moving seconds', () => {
    const first = leg(10, 0.001, 10);
    // Resumes ten minutes later.
    const second = leg(10, 0.001, 10, 5, START + 700_000);

    const summary = summarise([first, second]);
    expect(summary.movingSeconds).toBe(200);
    // Wall clock spans the pause; moving time does not.
    expect(summary.durationSeconds).toBeGreaterThan(700);
  });

  it('records one split per completed kilometre', () => {
    // ~2.22km at a constant 10s per 111m.
    const summary = summarise([leg(20, 0.001, 10)]);
    expect(summary.splits.map(s => s.km)).toEqual([1, 2]);

    // Constant speed, so both splits should agree to within a second.
    const [a, b] = summary.splits;
    expect(Math.abs(a.seconds - b.seconds)).toBeLessThanOrEqual(1);
  });

  it('attributes a boundary-crossing step proportionally', () => {
    // 100s covers 1.112km, so 1.000km should land at ~90s, not at 100s.
    const summary = summarise([leg(10, 0.001, 10)]);
    expect(summary.splits).toHaveLength(1);
    expect(summary.splits[0].seconds).toBeGreaterThan(85);
    expect(summary.splits[0].seconds).toBeLessThan(95);
  });

  it('withholds pace until there is enough distance to mean anything', () => {
    const barelyMoved = summarise([leg(1, 0.0001, 5)]);
    expect(barelyMoved.paceMinPerKm).toBeNull();

    const real = summarise([leg(20, 0.001, 10)]);
    expect(real.paceMinPerKm).not.toBeNull();
  });

  it('ignores GPS jitter below the step threshold', () => {
    // Standing still: repeated fixes a metre apart.
    const jitter: GeoPoint[] = Array.from({ length: 40 }, (_, i) => ({
      latitude: (i % 2) * 0.00001,
      longitude: 0,
      timestamp: START + i * 3000,
      accuracy: 8,
    }));
    expect(summarise([jitter]).distanceKm).toBe(0);
  });

  it('handles an empty track', () => {
    const summary = summarise([]);
    expect(summary.distanceKm).toBe(0);
    expect(summary.durationSeconds).toBe(0);
    expect(summary.paceMinPerKm).toBeNull();
  });
});

describe('formatDuration', () => {
  it('drops the hour when there is not one', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('pads minutes once hours appear', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('formatPace', () => {
  it('renders minutes per km', () => {
    expect(formatPace(5.5)).toBe('5:30 /km');
  });

  it('carries 60 seconds into the next minute', () => {
    // 5.999 rounds to 60s; "5:60 /km" would be nonsense.
    expect(formatPace(5.999)).toBe('6:00 /km');
  });

  it('shows a dash rather than inventing a number', () => {
    expect(formatPace(null)).toBe('—');
    expect(formatPace(Infinity)).toBe('—');
  });
});

describe('createAccumulator', () => {
  const at = (lat: number, lon: number, tSeconds: number): GeoPoint => ({
    latitude: lat,
    longitude: lon,
    timestamp: START + tSeconds * 1000,
    accuracy: 5,
  });

  it('keeps a normal sequence of fixes', () => {
    const acc = createAccumulator();
    expect(acc.add(at(0, 0, 0))).toBe(true);
    expect(acc.add(at(0.0005, 0, 10))).toBe(true); // ~5.6 m/s
    expect(acc.add(at(0.001, 0, 20))).toBe(true);
    expect(acc.segments[0]).toHaveLength(3);
  });

  it('replaces a stale first fix instead of drawing a phantom leg', () => {
    /*
     * The exact failure seen on device: the first fix was the last known
     * position from an earlier session, so the route showed a long spur out to
     * it and the distance was roughly double.
     */
    const acc = createAccumulator();
    acc.add(at(22.4765, 72.9326, 0)); // stale, ~800m away
    acc.add(at(22.47, 72.93, 3)); // where we actually are

    expect(acc.segments[0]).toHaveLength(1);
    expect(acc.segments[0][0].latitude).toBeCloseTo(22.47, 4);
    expect(summarise(acc.segments).distanceKm).toBe(0);
  });

  it('rejects a one-off teleport mid-track', () => {
    const acc = createAccumulator();
    acc.add(at(0, 0, 0));
    acc.add(at(0.0005, 0, 10));
    expect(acc.add(at(5, 0, 20))).toBe(false); // ~550km in 10s
    acc.add(at(0.001, 0, 30));
    expect(acc.segments[0]).toHaveLength(3);
  });

  it('believes the GPS after repeated rejects, in a new segment', () => {
    const acc = createAccumulator();
    acc.add(at(0, 0, 0));
    acc.add(at(0.0005, 0, 10));
    expect(acc.add(at(5, 0, 20))).toBe(false);
    expect(acc.add(at(5.0005, 0, 30))).toBe(false);
    // Third in a row: we really are somewhere else.
    expect(acc.add(at(5.001, 0, 40))).toBe(true);
    expect(acc.segments).toHaveLength(2);
    // The jump must not become distance.
    expect(summarise(acc.segments).distanceKm).toBeLessThan(1);
  });

  it('breaks a segment on pause without bridging the gap', () => {
    const acc = createAccumulator();
    acc.add(at(0, 0, 0));
    acc.add(at(0.001, 0, 20));
    acc.breakSegment();
    acc.add(at(0.002, 0, 600)); // resumed much later, further on
    acc.add(at(0.003, 0, 620));

    expect(acc.segments).toHaveLength(2);
    const summary = summarise(acc.segments);
    // Two legs of ~111m, and nothing for the gap between them.
    expect(summary.distanceKm).toBeCloseTo(0.22, 1);
  });

  it('does not break an empty segment twice', () => {
    const acc = createAccumulator();
    acc.breakSegment();
    acc.breakSegment();
    expect(acc.segments).toHaveLength(1);
  });
});
