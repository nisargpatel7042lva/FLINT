import type { Nudge } from './copy';

/**
 * Spark's voice for person-to-person nudges — SERVER copy.
 *
 * This is generated on the server from the nudge's `kind` and the sender's
 * display name, and the `message` field the client wrote is deliberately
 * ignored. A push notification is text that lands on someone's lock screen
 * without their consent; if the sending client could choose that text, the
 * nudge button would be a free channel for whatever a modified app wanted to
 * say to a stranger.
 *
 * The voice rules from `copy.ts` still apply — an invitation, never an
 * accusation — with one addition: a nudge is from a PERSON, so the sender's
 * name leads and Spark stays out of the way.
 */

export type PokeKind = 'poke' | 'challenge' | 'cheer';

const pick = <T>(options: T[], seed: number): T =>
  options[Math.abs(seed) % options.length];

/** Stable per-nudge variety without storing a seed. */
export const seedFrom = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return h;
};

export function pokeNudge(kind: PokeKind, senderName: string, seed = 0): Nudge {
  const name = senderName.trim() || 'A friend';

  switch (kind) {
    case 'challenge':
      return {
        title: `${name} challenged you`,
        body: pick(
          [
            'Head to head, starting whenever you are.',
            'They fancy their chances. Prove otherwise.',
            "A friendly one — but it's on.",
          ],
          seed,
        ),
      };
    case 'cheer':
      return {
        title: `${name} cheered you on`,
        body: pick(
          [
            'They saw your session and were impressed.',
            'That one counted, apparently.',
            'Someone noticed the work.',
          ],
          seed,
        ),
      };
    default:
      return {
        title: `${name} nudged you`,
        body: pick(
          [
            'No pressure — just a wave.',
            'The door is open whenever you fancy it.',
            'They reckon today looks like a good day for it.',
          ],
          seed,
        ),
      };
  }
}
