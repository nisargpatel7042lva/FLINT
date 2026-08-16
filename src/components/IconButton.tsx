import React from 'react';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';

export type IconButtonVariant = 'dark' | 'light' | 'accent' | 'muted';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export type IconButtonProps = {
  /** A lucide icon element. Colour it with `useIconColor` or pass explicitly. */
  children: React.ReactNode;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DIAMETER: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 56 };

/**
 * The round icon buttons that sit in the reference's headers and tab bars.
 * Always circular — that shape is part of the visual language.
 */
export function IconButton({
  children,
  onPress,
  variant = 'light',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const d = DIAMETER[size];

  const surface: Record<IconButtonVariant, ViewStyle> = {
    dark: { backgroundColor: theme.colors.surfaceInverse },
    light: { backgroundColor: theme.colors.surface },
    accent: { backgroundColor: theme.colors.accent },
    muted: { backgroundColor: theme.colors.surfaceMuted },
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        surface[variant],
        { width: d, height: d, borderRadius: d / 2 },
        theme.shadows.sm,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}>
      {children}
    </Pressable>
  );
}

/** Convenience: the icon colour that reads correctly on each variant. */
export function useIconColor(variant: IconButtonVariant = 'light'): string {
  const theme = useTheme();
  switch (variant) {
    case 'dark':
      return theme.colors.textInverse;
    case 'accent':
      return theme.colors.onAccent;
    default:
      return theme.colors.text;
  }
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.45 },
});
