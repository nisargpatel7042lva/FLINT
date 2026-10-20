import { launchImageLibrary } from 'react-native-image-picker';

/** Mirrors the profiles rule: anything bigger is refused by the server. */
export const MAX_PHOTO_CHARS = 150_000;

export type PickedPhoto =
  | { state: 'picked'; dataUrl: string }
  | { state: 'cancelled' }
  | { state: 'too-big' };

/**
 * Picks a profile photo from the gallery, shrunk small enough to live on the
 * profile itself.
 *
 * Small on purpose: an avatar is shown at 40–96 px, so 320 px is already
 * twice what any screen needs, and at that size a JPEG is ~15–30 KB. If the
 * first pass is still too big (a busy photo, or a PNG), it tries once more,
 * smaller and more compressed, before giving up.
 */
export async function pickProfilePhoto(): Promise<PickedPhoto> {
  for (const [size, quality] of [
    [320, 0.7],
    [200, 0.5],
  ] as const) {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: size,
      maxHeight: size,
      quality,
      includeBase64: true,
      selectionLimit: 1,
    });
    if (res.didCancel) {
      return { state: 'cancelled' };
    }
    const asset = res.assets?.[0];
    if (!asset?.base64) {
      return { state: 'cancelled' };
    }
    const type = asset.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const dataUrl = `data:${type};base64,${asset.base64}`;
    if (dataUrl.length <= MAX_PHOTO_CHARS) {
      return { state: 'picked', dataUrl };
    }
  }
  return { state: 'too-big' };
}
