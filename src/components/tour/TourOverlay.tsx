import React from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../theme';
import { Button } from '../Button';
import { Text } from '../Text';
import { useTour } from './TourProvider';

const SCRIM = 'rgba(8,8,8,0.78)';
const PAD = 8;
const BUBBLE_GAP = 14;

/**
 * The walkthrough overlay: a dimmed screen with the current target cut out, and
 * a speech bubble beside it.
 *
 * The "hole" is four rectangles drawn around the target rather than a mask.
 * React Native has no cross-platform cutout primitive, and four plain views are
 * cheaper and more predictable than an SVG mask or a blend mode — the gap
 * between them IS the hole.
 */
export function TourOverlay() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { active, steps, index, rect, next, finish } = useTour();

  if (!active || steps.length === 0) {
    return null;
  }

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Until the target reports its position, centre the bubble rather than
  // flashing it in the wrong place.
  const hole = rect
    ? {
        x: Math.max(rect.x - PAD, 0),
        y: Math.max(rect.y - PAD, 0),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Put the bubble on whichever side has more room, so it never runs off screen.
  const below = hole ? hole.y + hole.height + BUBBLE_GAP : height / 2;
  const spaceBelow = height - below;
  const placeBelow = !hole || spaceBelow > 230;

  const bubbleStyle = hole
    ? placeBelow
      ? { top: below }
      : { bottom: height - hole.y + BUBBLE_GAP }
    : { top: height / 2 - 110 };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent
      onRequestClose={finish}>
      {hole ? (
        <>
          <View style={[styles.scrim, styles.scrimTop, { height: hole.y }]} />
          <View
            style={[styles.scrim, styles.scrimBottom, { top: hole.y + hole.height }]}
          />
          <View
            style={[
              styles.scrim,
              styles.scrimLeft,
              { top: hole.y, width: hole.x, height: hole.height },
            ]}
          />
          <View
            style={[
              styles.scrim,
              {
                top: hole.y,
                left: hole.x + hole.width,
                width: Math.max(width - (hole.x + hole.width), 0),
                height: hole.height,
              },
            ]}
          />
          {/* Ring around the cutout so the highlighted element reads as chosen. */}
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                top: hole.y,
                left: hole.x,
                width: hole.width,
                height: hole.height,
                borderColor: theme.colors.accent,
                borderRadius: theme.radius.xl,
              },
            ]}
          />
        </>
      ) : (
        <View style={[styles.scrim, StyleSheet.absoluteFill]} />
      )}

      <View style={[styles.bubbleWrap, bubbleStyle]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: theme.colors.surfaceBright,
              borderRadius: theme.radius.xxl,
            },
          ]}>
          <Text variant="label" tone="accent" uppercase>
            Step {index + 1} of {steps.length}
          </Text>
          <Text variant="h2" tone="onBright" style={styles.title}>
            {step.title}
          </Text>
          <Text variant="body" tone="muted" style={styles.body}>
            {step.body}
          </Text>

          <View style={styles.actions}>
            <Button label="Skip" variant="ghost" size="sm" onPress={finish} />
            <View style={styles.spacer} />
            <Button
              label={isLast ? 'Start training' : 'Next'}
              size="sm"
              onPress={next}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', backgroundColor: SCRIM },
  scrimTop: { top: 0, left: 0, right: 0 },
  scrimBottom: { left: 0, right: 0, bottom: 0 },
  scrimLeft: { left: 0 },
  ring: { position: 'absolute', borderWidth: 2 },
  bubbleWrap: { position: 'absolute', left: 16, right: 16 },
  bubble: { padding: 20 },
  title: { marginTop: 6 },
  body: { marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  spacer: { flex: 1 },
});
