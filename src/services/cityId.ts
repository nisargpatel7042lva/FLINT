import { sha256Hex } from './sha256';

/**
 * A city run's document id: sha256 of runner, run start and club.
 *
 * Deterministic, so one run lights the city once per club — the rules refuse
 * a second write to the same id. One-way, so the public map cannot be turned
 * back into a person. The rules compute the same hash from request.auth and
 * refuse any id that does not match. Kept free of React Native imports so the
 * rules tests can use it too.
 */
export function cityRunId(uid: string, runMs: number, clubId: string): string {
  return sha256Hex(`${uid}_${Math.floor(runMs)}_${clubId}`);
}
