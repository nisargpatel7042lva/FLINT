import { Platform, TextStyle } from 'react-native';

/**
 * Font families.
 *
 * These currently resolve to the platform system face. The reference design
 * uses a bold, slightly condensed grotesque for headlines — when that licensed
 * font is added to `src/assets/fonts` and linked, swap the values here and every
 * component picks it up automatically. Nothing else needs to change.
 */
export const fontFamily = {
  display: Platform.select({ android: 'sans-serif', default: 'System' }) as string,
  body: Platform.select({ android: 'sans-serif', default: 'System' }) as string,
  /** Condensed face used for big hero type on Android. */
  condensed: Platform.select({
    android: 'sans-serif-condensed',
    default: 'System',
  }) as string,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * The type scale.
 *
 * `display*` are the high-contrast hero styles ("Discipline is Power"): heavy
 * weight, tight leading, negative tracking. `stat*` are the large metric
 * numerals. Everything else is clean sans for body and UI chrome.
 */
export const typography = {
  displayLg: {
    fontFamily: fontFamily.display,
    fontSize: 44,
    lineHeight: 46,
    fontWeight: fontWeight.black,
    letterSpacing: -1.2,
  },
  displayMd: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    lineHeight: 39,
    fontWeight: fontWeight.black,
    letterSpacing: -0.9,
  },
  displaySm: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.6,
  },

  h1: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },

  body: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0,
  },
  bodySm: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.regular,
    letterSpacing: 0,
  },

  /** Small all-caps label that sits under a stat number. */
  label: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.6,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeight.medium,
    letterSpacing: 0,
  },
  button: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.2,
  },

  statLg: {
    fontFamily: fontFamily.display,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: fontWeight.black,
    letterSpacing: -1.5,
  },
  statMd: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.8,
  },
  statSm: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
