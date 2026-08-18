/**
 * PLACEHOLDER ASSETS — replace before launch.
 *
 * Every image in the app that has no real asset yet resolves through this file,
 * so swapping in production art means editing one module rather than hunting
 * through screens.
 *
 * ── Sources and licensing ─────────────────────────────────────────────────
 * All three are keyless and free for development. Verified reachable
 * 2026-08-16. `source.unsplash.com` was NOT used — it now returns 503 — and
 * Pexels was not used because it requires an API key.
 *
 *   i.pravatar.cc   Generated/CC avatar faces. Fine for dev.
 *   picsum.photos   Lorem Picsum, sourced from Unsplash. Unsplash Licence.
 *   loremflickr.com Proxies FLICKR images by topic. ⚠ Individual photos carry
 *                   their own Creative Commons terms, some requiring
 *                   attribution. This is the one to be careful about.
 *
 * ⚠ BEFORE SHIPPING: none of these should reach production. They are remote
 * calls to third-party hosts on every render, they are not deterministic, and
 * the Flickr-backed ones may require attribution. Replace with bundled or
 * CDN-hosted licensed assets.
 */

/** Deterministic small hash so the same name always gets the same face. */
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
 * Topics that match this app's subject matter.
 *
 * Only topics VERIFIED to return 200 from loremflickr are listed. 'fitness'
 * and 'yoga' both return HTTP 500 from that host and are deliberately absent —
 * keeping the union narrow means a screen cannot request a dead topic and
 * silently render an empty box.
 *
 * ⚠ RELEVANCE: this is Flickr *tag* search, not a curated library. 'gym',
 * 'running' and 'cycling' return usable shots; 'workout' returns a lot of
 * unrelated material (boats, crowds). Prefer 'gym' when the subject only needs
 * to read as fitness. This variability is the strongest argument for replacing
 * these with curated assets before any real demo.
 */
export type PhotoTopic = 'gym' | 'workout' | 'running' | 'cycling';

/**
 * PLACEHOLDER: replace with real workout/session photography.
 * `lock` keeps the same image for the same key instead of reshuffling.
 */
export const placeholderPhoto = (
  topic: PhotoTopic,
  key: string,
  width = 800,
  height = 600,
): string =>
  `https://loremflickr.com/${width}/${height}/${topic}?lock=${seedOf(key)}`;

/**
 * PLACEHOLDER: neutral imagery where the subject does not matter.
 * Lorem Picsum is more reliable than the topic-based source, so prefer it when
 * the content is incidental (card backdrops, empty states).
 */
export const placeholderNeutral = (
  key: string,
  width = 800,
  height = 600,
): string => `https://picsum.photos/seed/${seedOf(key)}/${width}/${height}`;

/** Convenience for RN `<Image source>`. */
export const remote = (uri: string) => ({ uri });
