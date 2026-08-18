import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { duration, easing, scale as scaleToken, spring, useTheme } from '../../theme';
import { Text } from '../Text';

/**
 * Char — the user's consistency, personified.
 *
 * Char is deliberately abstract: a soft glowing ember, not a character with a
 * face. That is a performance decision as much as an aesthetic one. Everything
 * animated here is `transform` and `opacity` on a handful of layers, so all
 * four states run on the UI thread at 60fps. A detailed creature would need
 * frame-by-frame art or path morphing to read as alive — exactly the
 * "expensive to animate badly" trap.
 *
 * States map to streak health, never to a level or score:
 *   dim         - no active streak. Char is asleep, barely breathing.
 *   glowing     - streak alive. Warm, steady, gently bobbing.
 *   concerned   - streak at risk today. Flickers, shrinks, sits lower.
 *   celebrating - milestone hit. One spring pop and an expanding halo ring.
 *
 * All timings come from `theme/motion.ts` so Char feels like the rest of the
 * app rather than its own thing.
 */
export type CharState = 'dim' | 'glowing' | 'concerned' | 'celebrating';

export type CharProps = {
  state?: CharState;
  /** Overall diameter in dp, including the halo. */
  size?: number;
  /** Optional caption rendered under Char. */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Abstract ember silhouette. Simple enough to stay crisp at any size. */
const BODY =
  'M12 2.2c0 0 6.6 5.6 6.6 10.6a6.6 6.6 0 0 1-13.2 0C5.4 7.8 12 2.2 12 2.2z';
const CORE = 'M12 9.4c0 0 3.1 2.7 3.1 5.1a3.1 3.1 0 0 1-6.2 0c0-2.4 3.1-5.1 3.1-5.1z';

export function Char({
  state = 'glowing',
  size = 96,
  label,
  style,
  testID,
}: CharProps) {
  const theme = useTheme();

  // One shared value per animated property, reused across states.
  const breathe = useSharedValue(1);
  const bob = useSharedValue(0);
  const bodyOpacity = useSharedValue(1);
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0.25);
  const burstScale = useSharedValue(0.6);
  const burstOpacity = useSharedValue(0);

  useEffect(() => {
    // Always clear previous loops before starting new ones, or states stack.
    cancelAnimation(breathe);
    cancelAnimation(bob);
    cancelAnimation(bodyOpacity);
    cancelAnimation(haloScale);
    cancelAnimation(haloOpacity);

    const loop = (v: number, ms: number) =>
      withRepeat(withTiming(v, { duration: ms, easing: easing.breathe }), -1, true);

    switch (state) {
      case 'dim':
        // Asleep: almost imperceptible movement, no halo.
        breathe.value = loop(1.02, duration.ambientSlow);
        bob.value = withTiming(0, { duration: duration.base });
        bodyOpacity.value = withTiming(0.4, { duration: duration.slow });
        haloOpacity.value = withTiming(0, { duration: duration.slow });
        haloScale.value = withTiming(1, { duration: duration.slow });
        break;

      case 'glowing':
        // Alive: steady breathing, gentle bob, pulsing halo.
        breathe.value = loop(scaleToken.breathe, duration.ambient);
        bob.value = loop(-4, duration.ambient);
        bodyOpacity.value = withTiming(1, { duration: duration.slow });
        haloOpacity.value = loop(0.34, duration.ambient);
        haloScale.value = loop(1.18, duration.ambient);
        break;

      case 'concerned':
        // At risk: faster, shallower, irregular - reads as unsettled.
        breathe.value = loop(0.95, duration.base * 3);
        bob.value = withTiming(3, { duration: duration.slow });
        bodyOpacity.value = withRepeat(
          withSequence(
            withTiming(0.45, { duration: 260, easing: easing.flicker }),
            withTiming(0.9, { duration: 180, easing: easing.flicker }),
            withTiming(0.6, { duration: 420, easing: easing.flicker }),
          ),
          -1,
          true,
        );
        haloOpacity.value = withTiming(0.12, { duration: duration.slow });
        haloScale.value = withTiming(1, { duration: duration.slow });
        break;

      case 'celebrating':
        // Milestone: one spring pop plus an expanding ring. Rule 2 in motion.ts
        // is the only place overshoot is welcome.
        bodyOpacity.value = withTiming(1, { duration: duration.fast });
        bob.value = withSpring(-8, spring.pop);
        breathe.value = withSequence(
          withSpring(scaleToken.pop * 1.12, spring.pop),
          withSpring(1, spring.settle),
        );
        haloOpacity.value = withSequence(
          withTiming(0.5, { duration: duration.fast }),
          withDelay(duration.base, withTiming(0.3, { duration: duration.deliberate })),
        );
        haloScale.value = withSequence(
          withSpring(1.35, spring.pop),
          withSpring(1.1, spring.settle),
        );
        burstScale.value = withSequence(
          withTiming(0.6, { duration: 0 }),
          withTiming(1.9, { duration: duration.deliberate, easing: easing.decelerate }),
        );
        burstOpacity.value = withSequence(
          withTiming(0.45, { duration: duration.instant }),
          withTiming(0, { duration: duration.deliberate, easing: easing.accelerate }),
        );
        break;
    }
  }, [
    state,
    breathe,
    bob,
    bodyOpacity,
    haloScale,
    haloOpacity,
    burstScale,
    burstOpacity,
  ]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bob.value }, { scale: breathe.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  // Colour is state-derived rather than animated - an animated fill would not
  // run on the UI thread, and the state change is already carried by motion.
  const bodyColor = state === 'dim' ? theme.colors.textMuted : theme.colors.accent;
  const coreColor =
    state === 'dim'
      ? theme.colors.borderStrong
      : state === 'concerned'
      ? theme.colors.accentSoft
      : theme.colors.onAccent;

  const glyph = size * 0.56;
  const haloSize = size * 0.86;

  return (
    <View testID={testID} style={[{ width: size, height: size }, styles.root, style]}>
      {/* Expanding ring, celebration only. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          burstStyle,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            borderColor: theme.colors.accent,
          },
          styles.burstRing,
        ]}
      />

      {/* Soft glow behind the body. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          haloStyle,
          {
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: theme.colors.accent,
          },
        ]}
      />

      <Animated.View style={[styles.layer, bodyStyle]}>
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <Path d={BODY} fill={bodyColor} />
          <Path d={CORE} fill={coreColor} opacity={state === 'dim' ? 0.5 : 0.85} />
        </Svg>
      </Animated.View>

      {label ? (
        <Text variant="label" tone="muted" uppercase style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Maps streak data to Char's state, so every screen tells the same story.
 * `atRisk` means the streak is alive but nothing has been logged today.
 */
export function charStateForStreak(
  streakDays: number,
  opts: { atRisk?: boolean; celebrating?: boolean } = {},
): CharState {
  if (opts.celebrating) {
    return 'celebrating';
  }
  if (streakDays <= 0) {
    return 'dim';
  }
  return opts.atRisk ? 'concerned' : 'glowing';
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  burstRing: { borderWidth: 2 },
  label: { position: 'absolute', bottom: -18 },
});
