import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type RadiusKey, type SpacingKey } from '../theme';

export type PhotoCardProps = {
  source: ImageSourcePropType;
  height?: number;
  /**
   * Darkening scrim strength, 0–1. Photography varies wildly in exposure, so
   * overlaid text is only legible if the image is pinned under a scrim — this
   * is the difference between "designed" and "text dumped on a photo".
   */
  scrim?: number;
  /** Anchor content to the bottom (the usual) or spread top-and-bottom. */
  layout?: 'bottom' | 'spread';
  padding?: SpacingKey;
  radius?: RadiusKey;
  /** Accent hairline, used to mark the suggested item. */
  highlighted?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 7): full-bleed photo card.
 *
 * The reference design is photo-led — its hero cards are athlete photography
 * with type sitting on top, not a thumbnail beside a label. This is that card.
 *
 * The scrim is a plain translucent overlay rather than a gradient because a
 * gradient would mean pulling in a native linear-gradient module; at these card
 * sizes a flat scrim plus a stronger bottom band reads the same and costs
 * nothing.
 */
export function PhotoCard({
  source,
  height = 180,
  scrim = 0.45,
  layout = 'bottom',
  padding = 'base',
  radius = 'xxl',
  highlighted = false,
  children,
  style,
  testID,
}: PhotoCardProps) {
  const theme = useTheme();
  const r = theme.radius[radius];

  return (
    <ImageBackground
      testID={testID}
      source={source}
      imageStyle={{ borderRadius: r }}
      style={[
        styles.root,
        {
          height,
          borderRadius: r,
          // Shows through while the photo loads, so the card never flashes white.
          backgroundColor: theme.colors.surfaceInverse,
        },
        highlighted ? [styles.highlight, { borderColor: theme.colors.accent }] : null,
        style,
      ]}>
      {/* Flat scrim across the whole card. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(8,8,8,${scrim})`, borderRadius: r },
        ]}
      />
      {/*
        Stepped gradient toward the bottom, where the type sits.

        A single band leaves a visible hard seam across the photo. Stacking a
        few progressively darker slices approximates a gradient closely enough
        at this size, without pulling in a native linear-gradient module.
      */}
      {GRADIENT_STEPS.map((step, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.step,
            {
              height: `${step.height}%`,
              backgroundColor: `rgba(8,8,8,${Math.min(scrim * step.alpha, 0.92)})`,
              borderBottomLeftRadius: r,
              borderBottomRightRadius: r,
            },
          ]}
        />
      ))}

      <View
        style={[
          styles.content,
          layout === 'spread' ? styles.spread : styles.bottom,
          { padding: theme.spacing[padding] },
        ]}>
        {children}
      </View>
    </ImageBackground>
  );
}

/** Bottom-anchored slices, largest and lightest first. */
const GRADIENT_STEPS = [
  { height: 70, alpha: 0.35 },
  { height: 52, alpha: 0.55 },
  { height: 36, alpha: 0.8 },
  { height: 22, alpha: 1.0 },
];

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  highlight: { borderWidth: 2 },
  step: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  content: { flex: 1 },
  spread: { justifyContent: 'space-between' },
  bottom: { justifyContent: 'flex-end' },
});
