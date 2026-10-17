/**
 * Web Mercator, the projection every street-tile server uses.
 *
 * World pixel coordinates at zoom z: the whole world is a square
 * 256·2^z pixels across, with (0,0) at the top-left (180°W, ~85°N). Tiles are
 * 256-pixel squares of that, numbered from the same corner.
 */

export const TILE_PX = 256;

const worldSize = (z: number) => TILE_PX * 2 ** z;

/** Beyond this Mercator goes to infinity; tile servers stop here too. */
const MAX_LAT = 85.05112878;

export function project(lat: number, lon: number, z: number): { x: number; y: number } {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const s = worldSize(z);
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * s,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s,
  };
}

export function unproject(x: number, y: number, z: number): { latitude: number; longitude: number } {
  const s = worldSize(z);
  const n = Math.PI - (2 * Math.PI * y) / s;
  return {
    latitude: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    longitude: (x / s) * 360 - 180,
  };
}

export type TileRef = { z: number; x: number; y: number; key: string };

/** Every tile touching a world-pixel rectangle. */
export function tilesFor(
  left: number,
  top: number,
  width: number,
  height: number,
  z: number,
): TileRef[] {
  const max = 2 ** z - 1;
  const x0 = Math.max(0, Math.floor(left / TILE_PX));
  const x1 = Math.min(max, Math.floor((left + width) / TILE_PX));
  const y0 = Math.max(0, Math.floor(top / TILE_PX));
  const y1 = Math.min(max, Math.floor((top + height) / TILE_PX));
  const out: TileRef[] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      out.push({ z, x, y, key: `${z}/${x}/${y}` });
    }
  }
  return out;
}
