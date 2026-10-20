/**
 * Encoded polyline (Google's format), for storing a run's route compactly.
 *
 * A 5 km run is a few hundred points; as JSON that is ~25 KB, encoded it is
 * ~2 KB. Routes are kept on the phone only — this is never uploaded.
 */

import type { GeoPoint, Segment } from './location';

const PRECISION = 1e5;

/* eslint-disable no-bitwise -- the format is defined in terms of bit ops. */
function encodeNumber(n: number): string {
  let v = n < 0 ? ~(n << 1) : n << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(points: Array<{ latitude: number; longitude: number }>): string {
  let lastLat = 0;
  let lastLon = 0;
  let out = '';
  points.forEach(p => {
    const lat = Math.round(p.latitude * PRECISION);
    const lon = Math.round(p.longitude * PRECISION);
    out += encodeNumber(lat - lastLat) + encodeNumber(lon - lastLon);
    lastLat = lat;
    lastLon = lon;
  });
  return out;
}

export function decodePolyline(s: string): Array<{ latitude: number; longitude: number }> {
  const out: Array<{ latitude: number; longitude: number }> = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i < s.length + 1);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next();
    lon += next();
    out.push({ latitude: lat / PRECISION, longitude: lon / PRECISION });
  }
  return out;
}
/* eslint-enable no-bitwise */

/** Segments → one string, pauses kept as `|` so a gap is never drawn as a line. */
export function encodeRoute(segments: Segment[]): string {
  return segments
    .filter(s => s.length > 1)
    .map(s => encodePolyline(s))
    .join('|');
}

export function decodeRoute(route: string): Segment[] {
  if (!route) {
    return [];
  }
  return route.split('|').map(part =>
    decodePolyline(part).map(
      (p): GeoPoint => ({ ...p, timestamp: 0, accuracy: null }),
    ),
  );
}
