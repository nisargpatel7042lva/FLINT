/**
 * Imagery.
 *
 * Athlete photography is a CURATED set of real Unsplash photos, each URL
 * verified to return 200 image/jpeg on 2026-08-23. This replaced LoremFlickr,
 * whose tag search returned whatever was tagged "workout" — boats, crowds,
 * wrestling matches — because it is a random Flickr query, not a library.
 *
 * ── Licensing ─────────────────────────────────────────────────────────────
 * These are all `images.unsplash.com`, i.e. the free **Unsplash License**:
 * free for commercial and non-commercial use, no permission needed, attribution
 * appreciated but not required. Photographer credits are recorded below so
 * attribution is possible.
 *
 * `plus.unsplash.com` (Unsplash+) photos are deliberately EXCLUDED — those
 * require a paid subscription and must not ship.
 *
 * ⚠ Still placeholders. They are third-party network requests on every render
 * and Unsplash can rate-limit or retire an image. For production, download the
 * chosen shots and bundle or CDN-host them. Avatars remain generated faces.
 */

/** Deterministic small hash so the same key always resolves to the same photo. */
const seedOf = (input: string): number => {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) % 100000;
  }
  return h;
};

/**
 * PLACEHOLDER: replace with real user avatars.
 * Stable per name, so a person keeps the same face across screens.
 */
export const placeholderAvatar = (name: string, size = 200): string =>
  `https://i.pravatar.cc/${size}?u=${seedOf(name)}`;

/**
 * Subject categories. Named for what the pools ACTUALLY contain — there is no
 * `cycling` because no cycling shot was verified, and a topic that silently
 * returns unrelated imagery is how the previous source went wrong.
 */
export type PhotoTopic = 'strength' | 'running' | 'conditioning' | 'fitness';

/**
 * Verified Unsplash photo ids, with photographer credit.
 * Every id below was confirmed to return 200 image/jpeg.
 */
const POOLS: Record<PhotoTopic, string[]> = {
  // Barbell / dumbbell / lifting.
  strength: [
    'photo-1541534741688-6078c6bfb5c5', // John Arano
    'photo-1556817411-31ae72fa3ea0', // Victor Freitas
    'photo-1517838277536-f5f99be501cd', // Victor Freitas
    'photo-1534258936925-c58bed479fcb', // Meghan Holmes
  ],
  // Track, road and trail running.
  running: [
    'photo-1461896836934-ffe607ba8211', // Braden Collum
    'photo-1470468969717-61d5d54fd036', // Clem Onojeghuo
  ],
  // Higher-intensity mixed work.
  conditioning: [
    'photo-1599058917212-d750089bc07e', // Karsten Winegeart - battle ropes
    'photo-1530549387789-4c1017266635', // Gentrit Sylejmani - swimming
    'photo-1571019614242-c5c5dee9f50b', // Jonathan Borba - partner training
  ],
  // General gym / training imagery.
  fitness: [
    'photo-1645810798586-08e892108d67',
    'photo-1552848031-326ec03fe2ec',
    'photo-1609899464726-209befaac5bc',
    'photo-1573858129683-59f4d9c445d9',
    'photo-1772450014685-369473acebc2',
    'photo-1649888216899-047093431441',
  ],
};

/**
 * A real athlete photo for the given subject.
 *
 * `key` picks deterministically from the pool, so a given card always shows the
 * same shot instead of reshuffling on every render. Width/quality are baked
 * into the URL so Unsplash serves an already-resized image rather than a
 * multi-megabyte original.
 */
export const placeholderPhoto = (
  topic: PhotoTopic,
  key: string,
  width = 800,
  height = 600,
): string => {
  const pool = POOLS[topic];
  const id = pool[seedOf(key) % pool.length];
  return `https://images.unsplash.com/${id}?w=${width}&h=${height}&q=70&fit=crop&crop=entropy&auto=format`;
};

/**
 * PLACEHOLDER: neutral imagery where the subject does not matter.
 * Lorem Picsum, free under the Unsplash License.
 */
export const placeholderNeutral = (
  key: string,
  width = 800,
  height = 600,
): string => `https://picsum.photos/seed/${seedOf(key)}/${width}/${height}`;

/** Convenience for RN `<Image source>`. */
export const remote = (uri: string) => ({ uri });
