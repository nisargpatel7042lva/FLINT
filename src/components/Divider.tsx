import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type DividerProps = {
  /** Centred label, e.g. "or continue with". */
  label?: string;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 2): hairline rule, optionally with a centred label.
 * Separates primary auth from social auth.
 */
export function Divider({ label, onDark = false, style, testID }: DividerProps) {
  const theme = useTheme();
  const line = onDark ? theme.colors.borderInverse : theme.colors.border;

  if (!label) {
    return (
      <View testID={testID} style={[styles.rule, { backgroundColor: line }, style]} />
    );
  }

  return (
    <View testID={testID} style={[styles.row, style]}>
      <View style={[styles.flexRule, { backgroundColor: line }]} />
      <Text variant="caption" tone={onDark ? 'inverseMuted' : 'muted'}>
        {label}
      </Text>
      <View style={[styles.flexRule, { backgroundColor: line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth * 2, width: '100%' },
  flexRule: { height: StyleSheet.hairlineWidth * 2, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
});
