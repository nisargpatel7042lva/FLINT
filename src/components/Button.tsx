import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { Text, type TextTone } from './Text';

export type ButtonVariant = 'primary' | 'dark' | 'light' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered before the label — pass a lucide icon element. */
  iconLeft?: React.ReactNode;
  /** Rendered after the label. */
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Pill by default, matching the reference CTAs. */
  square?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SIZES: Record<ButtonSize, { height: number; padH: number; gap: number }> = {
  sm: { height: 36, padH: 14, gap: 6 },
  md: { height: 48, padH: 20, gap: 8 },
  lg: { height: 56, padH: 24, gap: 10 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  loading = false,
  square = false,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const dims = SIZES[size];

  const surface: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.colors.accent },
    dark: { backgroundColor: theme.colors.surfaceInverse },
    light: { backgroundColor: theme.colors.surface },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.colors.borderStrong,
    },
    ghost: { backgroundColor: 'transparent' },
  };

  const pressedSurface: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.colors.accentPressed },
    dark: { backgroundColor: theme.colors.surfaceInverseMuted },
    light: { backgroundColor: theme.colors.surfaceMuted },
    outline: { backgroundColor: theme.colors.surfaceMuted },
    ghost: { backgroundColor: theme.colors.surfaceMuted },
  };

  const labelTone: Record<ButtonVariant, TextTone> = {
    primary: 'onAccent',
    dark: 'inverse',
    light: 'default',
    outline: 'default',
    ghost: 'accent',
  };

  const spinnerColor =
    variant === 'primary'
      ? theme.colors.onAccent
      : variant === 'dark'
      ? theme.colors.textInverse
      : theme.colors.accent;

  const isInert = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      onPress={onPress}
      disabled={isInert}
      style={({ pressed }) => [
        styles.base,
        surface[variant],
        {
          height: dims.height,
          paddingHorizontal: dims.padH,
          columnGap: dims.gap,
          borderRadius: square ? theme.radius.lg : theme.radius.pill,
        },
        variant === 'ghost' || variant === 'outline'
          ? theme.shadows.none
          : theme.shadows.sm,
        fullWidth ? styles.fullWidth : null,
        pressed && !isInert ? pressedSurface[variant] : null,
        disabled ? styles.disabled : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {iconLeft ? <View>{iconLeft}</View> : null}
          <Text variant="button" tone={labelTone[variant]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <View>{iconRight}</View> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch', width: '100%' },
  disabled: { opacity: 0.45 },
});
