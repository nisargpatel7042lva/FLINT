import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text, type TextTone } from './Text';

export type ChipVariant = 'dark' | 'light' | 'accent' | 'muted' | 'outline';

export type ChipProps = {
  label: string;
  /** Optional emphasised value shown after the label, e.g. "30m". */
  value?: string;
  icon?: React.ReactNode;
  variant?: ChipVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Small pill used for metadata: "Day Time · 30m", "In Progress", "Beginner".
 * Always fully rounded and content-width.
 */
export function Chip({
  label,
  value,
  icon,
  variant = 'dark',
  style,
  testID,
}: ChipProps) {
  const theme = useTheme();

  const surface: Record<ChipVariant, ViewStyle> = {
    dark: { backgroundColor: theme.colors.surfaceInverse },
    light: { backgroundColor: theme.colors.surface },
    accent: { backgroundColor: theme.colors.accent },
    muted: { backgroundColor: theme.colors.surfaceMuted },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.borderInverse,
    },
  };

  const labelTone: Record<ChipVariant, TextTone> = {
    dark: 'inverseMuted',
    light: 'muted',
    accent: 'onAccent',
    muted: 'muted',
    outline: 'inverseMuted',
  };

  const valueTone: Record<ChipVariant, TextTone> = {
    dark: 'inverse',
    light: 'default',
    accent: 'onAccent',
    muted: 'default',
    outline: 'inverse',
  };

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        surface[variant],
        {
          borderRadius: theme.radius.pill,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
        style,
      ]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text variant="caption" tone={labelTone[variant]}>
        {label}
      </Text>
      {value ? (
        <Text variant="bodyStrong" tone={valueTone[variant]} style={styles.value}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    columnGap: 6,
  },
  icon: { marginRight: 1 },
  value: { marginLeft: 2 },
});
