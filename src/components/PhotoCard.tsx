import React, { useId } from 'react';
import {
  ImageBackground,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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
 * The scrim is a real SVG linear gradient, drawn with react-native-svg (already
 * a dependency). It started as a stack of translucent slices to avoid pulling
 * in a native gradient module, but no number of slices removes the problem: on
 * a light photograph the opacity step between slices reads as visible
 * horizontal banding. A genuine gradient has no steps to see.
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

  // SVG gradient ids are document-global, so two PhotoCards on one screen would
  // otherwise share (and fight over) the same definition.
  const gradientId = `photocard-scrim-${useId()}`;

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
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {/* Light at the top so the photo still reads, heavy where type sits. */}
            <Stop offset="0" stopColor={SCRIM_COLOR} stopOpacity={scrim * 0.55} />
            <Stop offset="0.45" stopColor={SCRIM_COLOR} stopOpacity={scrim * 0.8} />
            <Stop
              offset="1"
              stopColor={SCRIM_COLOR}
              stopOpacity={Math.min(scrim + 0.42, 0.94)}
            />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>

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

/** Near-black rather than pure black, matching the darkest palette ink. */
const SCRIM_COLOR = '#080808';

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  highlight: { borderWidth: 2 },
  content: { flex: 1 },
  spread: { justifyContent: 'space-between' },
  bottom: { justifyContent: 'flex-end' },
});
