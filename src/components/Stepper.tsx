import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered under the number, e.g. "reps". */
  label?: string;
  suffix?: string;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 5): numeric stepper.
 *
 * Built for the logging screen, where friction is the enemy. Targets are
 * deliberately large and the value is never a text input — typing a number on a
 * phone mid-set costs far more than two taps, and a keyboard covering the screen
 * is worse still.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  suffix,
  onDark = false,
  style,
  testID,
}: StepperProps) {
  const theme = useTheme();

  const clamp = (n: number) => Math.min(Math.max(n, min), max);
  const iconColor = onDark ? theme.colors.textInverse : theme.colors.text;

  return (
    <View testID={testID} style={[styles.root, style]}>
      <IconButton
        accessibilityLabel={`Decrease${label ? ` ${label}` : ''}`}
        variant={onDark ? 'dark' : 'muted'}
        size="md"
        disabled={value <= min}
        onPress={() => onChange(clamp(value - step))}>
        <Minus color={iconColor} size={18} />
      </IconButton>

      <View style={styles.readout}>
        <Text variant="statSm" tone={onDark ? 'inverse' : 'default'}>
          {value}
          {suffix}
        </Text>
        {label ? (
          <Text variant="label" tone={onDark ? 'inverseMuted' : 'muted'} uppercase>
            {label}
          </Text>
        ) : null}
      </View>

      <IconButton
        accessibilityLabel={`Increase${label ? ` ${label}` : ''}`}
        variant={onDark ? 'dark' : 'muted'}
        size="md"
        disabled={value >= max}
        onPress={() => onChange(clamp(value + step))}>
        <Plus color={iconColor} size={18} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  readout: { minWidth: 64, alignItems: 'center' },
});
