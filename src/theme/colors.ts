/**
 * Raw colour primitives.
 *
 * Nothing in the app should import from here directly — consume the resolved
 * `theme.colors` via `useTheme()` instead. These are the unopinionated values
 * that the semantic roles in `index.ts` are built from.
 */

export const palette = {
  /** Near-black surfaces. The signature "dark card on a light page" look. */
  ink950: '#080808',
  ink900: '#0D0D0D',
  ink850: '#141414',
  ink800: '#1A1A1A',
  ink700: '#242424',
  ink600: '#2E2E30',
  ink500: '#3A3A3D',

  /** Warm off-white / cream page backgrounds. */
  cream50: '#FBF9F6',
  cream100: '#F5F1EC',
  cream200: '#EDE7E0',
  cream300: '#E2DAD1',

  white: '#FFFFFF',

  /** Muted greys for secondary text and hairlines. */
  grey500: '#8E8E93',
  grey400: '#A3A3A8',
  grey300: '#C4C4C9',

  /** Primary accent — bold orange, used sparingly. */
  orange500: '#FF6B1A',
  orange600: '#E85A0C',
  orange400: '#FF8A4C',
  orange100: '#FFE4D2',

  /** Alternate accents, kept available for the layout variants. */
  lime500: '#C8F14D',
  lime600: '#B2DC33',
  lime100: '#F0FBD0',

  emerald500: '#2ED3A7',
  emerald600: '#1DB78D',
  emerald100: '#D2F6EC',

  /** Status colours. */
  red500: '#E5484D',
  amber500: '#F5A524',
  green500: '#30A46C',
} as const;

export type AccentName = 'orange' | 'lime' | 'emerald';

export type Accent = {
  /** The bold accent itself — CTAs, active states, key numbers. */
  base: string;
  /** Pressed / darker state. */
  pressed: string;
  /** Lighter tint for hover-ish and subtle fills. */
  tint: string;
  /** Very soft wash for accent-tinted backgrounds. */
  soft: string;
  /** Text/icon colour that sits legibly on top of `base`. */
  on: string;
};

/**
 * Orange is the product's primary accent. The others exist so alternate
 * layouts can be dropped in without re-theming every component.
 */
export const accents: Record<AccentName, Accent> = {
  orange: {
    base: palette.orange500,
    pressed: palette.orange600,
    tint: palette.orange400,
    soft: palette.orange100,
    on: palette.white,
  },
  lime: {
    base: palette.lime500,
    pressed: palette.lime600,
    tint: palette.lime500,
    soft: palette.lime100,
    on: palette.ink900,
  },
  emerald: {
    base: palette.emerald500,
    pressed: palette.emerald600,
    tint: palette.emerald500,
    soft: palette.emerald100,
    on: palette.ink900,
  },
};
