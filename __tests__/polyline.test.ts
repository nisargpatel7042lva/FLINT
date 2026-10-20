import { decodePolyline, decodeRoute, encodePolyline, encodeRoute } from '../src/services/polyline';

describe('polyline', () => {
  it('matches Google’s published example', () => {
    const pts = [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ];
    expect(encodePolyline(pts)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(pts);
  });

  it('round-trips a route with a pause to about a metre', () => {
    const seg = (lat0: number) =>
      Array.from({ length: 50 }, (_, i) => ({
        latitude: lat0 + i * 0.000123,
        longitude: 73.1812 + i * 0.0000456,
        timestamp: i,
        accuracy: 5,
      }));
    const route = encodeRoute([seg(22.30), seg(22.31)]);
    const back = decodeRoute(route);
    expect(back).toHaveLength(2);
    expect(back[1]).toHaveLength(50);
    expect(Math.abs(back[1][49].latitude - (22.31 + 49 * 0.000123))).toBeLessThan(0.00001);
  });
});
