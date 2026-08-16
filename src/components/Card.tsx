import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme, type RadiusKey, type ShadowKey, type SpacingKey } from '../theme';

/**
 * Card surfaces.
 *
 * `dark` is the signature near-black card and is the default — it reads the
 * same on a cream page or a dark one. `accent` is the bold orange card used
 * for the single most important item in a list, never for several at once.
 */
export type CardVariant =
  | 'dark'
  | 'light'
  | 'accent'
  | 'muted'
  | 'outline'
  /** Always-light card, stays bright even in dark mode. */
  | 'bright';

export type CardProps = {
  variant?: CardVariant;
  padding?: SpacingKey;
  radius?: RadiusKey;
  elevation?: ShadowKey;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Providing `onPress` upgrades the card to a pressable with a dim effect. */
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  testID?: string;
};

export function Card({
  variant = 'dark',
  padding = 'lg',
  radius = 'xxl',
  elevation = 'md',
  style,
  children,
  onPress,
  disabled = false,
  testID,
}: CardProps) {
  const theme = useTheme();

  const surface: Record<CardVariant, ViewStyle> = {
    dark: { backgroundColor: theme.colors.surfaceInverse },
    light: { backgroundColor: theme.colors.surface },
    bright: { backgroundColor: theme.colors.surfaceBright },
    accent: { backgroundColor: theme.colors.accent },
    muted: { backgroundColor: theme.colors.surfaceMuted },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: theme.colors.border,
    },
  };

  const base: StyleProp<ViewStyle> = [
    surface[variant],
    {
      padding: theme.spacing[padding],
      borderRadius: theme.radius[radius],
    },
    variant === 'outline' ? theme.shadows.none : theme.shadows[elevation],
    style,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={base}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        base,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
