import { Accent, AccentName, accents, palette } from './colors';
import { radius, spacing } from './spacing';
import { shadows } from './shadows';
import { fontFamily, fontWeight, typography } from './typography';

export type ThemeMode = 'light' | 'dark';

/**
 * Semantic colour roles.
 *
 * Components only ever reference these names, never raw hex. That is what lets
 * the accent and the light/dark mode be swapped without touching a component.
 */
export type ThemeColors = {
  /** Page background. */
  background: string;
  /** Default raised surface sitting on the background. */
  surface: string;
  /** Secondary surface — inputs, inset wells, muted rows. */
  surfaceMuted: string;

  /** The signature near-black card. Present in BOTH modes by design. */
  surfaceInverse: string;
  surfaceInverseMuted: string;

  /**
   * An always-light card, the counterpart to `surfaceInverse`. The reference
   * pairs a white card against a near-black page, so this must stay bright in
   * dark mode too — `surface` follows the mode and would go dark here.
   */
  surfaceBright: string;
  /** Text that sits on `surfaceBright`. Always dark. */
  textOnBright: string;

  text: string;
  textMuted: string;
  /** Text sitting on `surfaceInverse`. */
  textInverse: string;
  textInverseMuted: string;

  border: string;
  borderStrong: string;
  /** Hairline that reads correctly on a dark card. */
  borderInverse: string;

  accent: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;

  success: string;
  warning: string;
  danger: string;

  /** Scrim for modals / pressed overlays. */
  overlay: string;
};

const lightColors = (accent: Accent): ThemeColors => ({
  background: palette.cream100,
  surface: palette.white,
  surfaceMuted: palette.cream200,

  surfaceInverse: palette.ink900,
  surfaceInverseMuted: palette.ink800,

  surfaceBright: palette.white,
  textOnBright: palette.ink900,

  text: palette.ink900,
  textMuted: palette.grey500,
  textInverse: palette.white,
  textInverseMuted: palette.grey400,

  border: palette.cream300,
  borderStrong: palette.grey300,
  borderInverse: palette.ink700,

  accent: accent.base,
  accentPressed: accent.pressed,
  accentSoft: accent.soft,
  onAccent: accent.on,

  success: palette.green500,
  warning: palette.amber500,
  danger: palette.red500,

  overlay: 'rgba(13, 13, 13, 0.45)',
});

const darkColors = (accent: Accent): ThemeColors => ({
  background: palette.ink950,
  surface: palette.ink850,
  /**
   * Must stay one step lighter than BOTH `surface` and `surfaceInverse`, or
   * muted elements (avatars, stat pills) nested inside a dark card become
   * invisible against it.
   */
  surfaceMuted: palette.ink700,

  surfaceInverse: palette.ink800,
  surfaceInverseMuted: palette.ink600,

  surfaceBright: palette.cream50,
  textOnBright: palette.ink900,

  text: palette.white,
  textMuted: palette.grey500,
  textInverse: palette.white,
  textInverseMuted: palette.grey400,

  border: palette.ink700,
  borderStrong: palette.ink600,
  borderInverse: palette.ink600,

  accent: accent.base,
  accentPressed: accent.pressed,
  accentSoft: 'rgba(255, 107, 26, 0.16)',
  onAccent: accent.on,

  success: palette.green500,
  warning: palette.amber500,
  danger: palette.red500,

  overlay: 'rgba(0, 0, 0, 0.6)',
});

export type Theme = {
  mode: ThemeMode;
  accentName: AccentName;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
  fontFamily: typeof fontFamily;
  fontWeight: typeof fontWeight;
};

export const createTheme = (
  mode: ThemeMode = 'light',
  accentName: AccentName = 'orange',
): Theme => {
  const accent = accents[accentName];
  return {
    mode,
    accentName,
    colors: mode === 'dark' ? darkColors(accent) : lightColors(accent),
    spacing,
    radius,
    typography,
    shadows,
    fontFamily,
    fontWeight,
  };
};

/** Default app theme: cream page, near-black cards, orange accent. */
export const defaultTheme = createTheme('light', 'orange');
