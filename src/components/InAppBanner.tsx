import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Text } from './Text';

export type BannerContent = {
  key: string;
  title: string;
  body: string;
  icon?: React.ReactNode;
};

export type InAppBannerProps = {
  content: BannerContent | null;
  onPress: () => void;
  onDismiss: () => void;
  /** How long it stays before sliding away, in ms. */
  holdMs?: number;
};

/**
 * A notification that slides down from the top while the app is open.
 *
 * Android shows nothing for a push that arrives while the app is in front,
 * and a nudge that lands silently is a nudge nobody acts on. This is that
 * moment, in the app: it slides in, holds for a few seconds, slides away, and
 * a tap goes to where the nudge can be answered.
 */
export function InAppBanner({ content, onPress, onDismiss, holdMs = 5000 }: InAppBannerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-200);

  useEffect(() => {
    if (!content) {
      return;
    }
    y.value = -200;
    y.value = withTiming(0, { duration: 260 }, () => {
      y.value = withDelay(
        holdMs,
        withTiming(-200, { duration: 220 }, done => {
          if (done) {
            runOnJS(onDismiss)();
          }
        }),
      );
    });
  }, [content, holdMs, onDismiss, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!content) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }, style]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${content.title}. ${content.body}`}
        onPress={() => {
          y.value = withTiming(-200, { duration: 160 });
          onPress();
        }}
        style={[
          styles.card,
          { backgroundColor: theme.colors.surfaceInverse, borderRadius: theme.radius.xl },
          theme.shadows.xl,
        ]}>
        {content.icon ? <View style={styles.icon}>{content.icon}</View> : null}
        <View style={styles.flex}>
          <Text variant="bodyStrong" tone="inverse" numberOfLines={1}>
            {content.title}
          </Text>
          <Text variant="bodySm" tone="inverseMuted" numberOfLines={2}>
            {content.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 20 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, columnGap: 12 },
  icon: { width: 28, alignItems: 'center' },
  flex: { flex: 1 },
});
