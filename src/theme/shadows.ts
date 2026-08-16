import { Platform, ViewStyle } from 'react-native';

/**
 * Elevation tokens.
 *
 * The reference uses soft, wide, low-opacity shadows — depth is felt rather
 * than seen. Android only renders `elevation`, so each token carries both the
 * iOS shadow triplet and an Android elevation that reads at a similar weight.
 */
type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const make = (
  y: number,
  blur: number,
  opacity: number,
  elevation: number,
  color = '#000000',
): Shadow =>
  Platform.select({
    android: { elevation, shadowColor: color },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
  }) as Shadow;

export const shadows = {
  none: Platform.select({
    android: { elevation: 0 },
    default: { shadowOpacity: 0 },
  }) as Shadow,
  /** Barely-there lift for list rows and inputs. */
  sm: make(2, 6, 0.06, 2),
  /** Default card depth. */
  md: make(6, 16, 0.1, 5),
  /** Raised cards and sheets. */
  lg: make(12, 28, 0.14, 10),
  /** Floating action / tab bar. */
  xl: make(16, 36, 0.18, 16),
} as const;

export type ShadowKey = keyof typeof shadows;
