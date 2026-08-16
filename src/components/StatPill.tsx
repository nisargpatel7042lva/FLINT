import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text, type TextTone } from './Text';

export type StatPillVariant = 'dark' | 'light' | 'accent' | 'muted';
export type StatPillSize = 'sm' | 'md' | 'lg';

export type StatPillProps = {
  /** The headline number, pre-formatted (e.g. "6160", "2,233"). */
  value: string | number;
  /** Small caption under the number — "STEPS", "Kcal", "bpm". */
  label?: string;
  /** Trailing unit shown next to the value, e.g. "km". */
  unit?: string;
  /** A lucide icon element rendered before the value. */
  icon?: React.ReactNode;
  variant?: StatPillVariant;
  size?: StatPillSize;
  /** Lay the label beside the number instead of underneath it. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const VALUE_VARIANT = {
  sm: 'statSm',
  md: 'statMd',
  lg: 'statLg',
} as const;

const PAD = { sm: 'md', md: 'base', lg: 'lg' } as const;

/**
 * The bold-number-with-small-label unit from the reference: heart rate, steps,
 * calories. Deliberately dumb — it formats nothing and fetches nothing.
 */
export function StatPill({
  value,
  label,
  unit,
  icon,
  variant = 'dark',
  size = 'md',
  inline = false,
  style,
  testID,
}: StatPillProps) {
  const theme = useTheme();

  const surface: Record<StatPillVariant, ViewStyle> = {
    dark: { backgroundColor: theme.colors.surfaceInverse },
    light: { backgroundColor: theme.colors.surface },
    accent: { backgroundColor: theme.colors.accent },
    muted: { backgroundColor: theme.colors.surfaceMuted },
  };

  const valueTone: Record<StatPillVariant, TextTone> = {
    dark: 'inverse',
    light: 'default',
    accent: 'onAccent',
    muted: 'default',
  };

  const labelTone: Record<StatPillVariant, TextTone> = {
    dark: 'inverseMuted',
    light: 'muted',
    accent: 'onAccent',
    muted: 'muted',
  };

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        surface[variant],
        {
          padding: theme.spacing[PAD[size]],
          borderRadius: theme.radius.xl,
        },
        theme.shadows.sm,
        style,
      ]}>
      <View style={styles.valueRow}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text variant={VALUE_VARIANT[size]} tone={valueTone[variant]}>
          {value}
        </Text>
        {unit ? (
          <Text variant="caption" tone={labelTone[variant]} style={styles.unit}>
            {unit}
          </Text>
        ) : null}
        {inline && label ? (
          <Text
            variant="label"
            tone={labelTone[variant]}
            uppercase
            style={styles.inlineLabel}>
            {label}
          </Text>
        ) : null}
      </View>

      {!inline && label ? (
        <Text variant="label" tone={labelTone[variant]} uppercase style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
  valueRow: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  icon: { marginRight: 2 },
  unit: { marginBottom: 2 },
  inlineLabel: { marginLeft: 4 },
  label: { marginTop: 4 },
});
