/**
 * 4pt spacing scale. Every margin, padding and gap in the app should come from
 * here so vertical rhythm stays consistent across screens.
 */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  giant: 64,
} as const;

export type SpacingKey = keyof typeof spacing;

/**
 * Corner radii. The reference language is generously rounded — cards sit at
 * 20–24, and interactive chips are fully pill-shaped.
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;
