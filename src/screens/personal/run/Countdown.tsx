import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { Text } from '../../../components';
import { useTheme } from '../../../theme';

type Props = {
  onDone: () => void;
};

/**
 * Three, two, one.
 *
 * Not decoration. It is the moment the runner pockets the phone and starts
 * moving, so the first metre is recorded and not the walk back from the gate
 * after fiddling with the screen. Tap to skip.
 */
export function Countdown({ onDone }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [n, setN] = useState(3);

  useEffect(() => {
    if (n === 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setN(v => v - 1), 900);
    return () => clearTimeout(t);
  }, [n, onDone]);

  return (
    <Pressable
      style={[styles.root, { backgroundColor: theme.colors.accent }]}
      onPress={() => setN(0)}
      accessibilityRole="button"
      accessibilityLabel={`Starting in ${n}. Tap to start now.`}>
      {n > 0 ? (
        <Animated.View key={n} entering={reduced ? undefined : ZoomIn.duration(320)}>
          <Text variant="countdown" tone="onAccent">
            {n}
          </Text>
        </Animated.View>
      ) : null}
      <Text variant="bodyStrong" tone="onAccent" style={styles.hint}>
        Tap to start now
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 64, opacity: 0.8 },
});
