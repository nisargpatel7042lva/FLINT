import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type OptionCardProps = {
  title: string;
  description?: string;
  /** A lucide icon element shown in the leading slot. */
  icon?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 2): single-select card with an explicit selected state.
 *
 * `Card` has surface variants but no notion of selection, and selection needs
 * more than a colour swap — an accent border plus a check affordance, so the
 * choice is not conveyed by colour alone.
 */
export function OptionCard({
  title,
  description,
  icon,
  selected = false,
  onPress,
  disabled = false,
  style,
  testID,
}: OptionCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.base,
          columnGap: theme.spacing.md,
        },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}>
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: selected
                ? theme.colors.accent
                : theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
            },
          ]}>
          {icon}
        </View>
      ) : null}

      <View style={styles.copy}>
        <Text variant="h3">{title}</Text>
        {description ? (
          <Text variant="bodySm" tone="muted" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.check,
          {
            borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
            backgroundColor: selected ? theme.colors.accent : TRANSPARENT,
          },
        ]}>
        {selected ? <Check color={theme.colors.onAccent} size={14} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  description: { marginTop: 2 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
