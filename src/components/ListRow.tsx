import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Leading slot — typically an `Avatar` or an icon. */
  leading?: React.ReactNode;
  /** Trailing slot — typically a `Button` or `IconButton`. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Draw the row on a filled surface instead of transparent. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 2): leading / copy / trailing row.
 *
 * Friend search results and contact lists need a repeating row with an action
 * on the right. Composing this inline in each screen is exactly the one-off
 * styling the design system exists to prevent.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  filled = false,
  style,
  testID,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View style={styles.copy}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone="muted" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </>
  );

  const base: StyleProp<ViewStyle> = [
    styles.base,
    {
      columnGap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: filled ? theme.spacing.base : 0,
      borderRadius: theme.radius.xl,
      backgroundColor: filled ? theme.colors.surface : 'transparent',
    },
    style,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={base}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? styles.pressed : null]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
  subtitle: { marginTop: 1 },
  pressed: { opacity: 0.7 },
});
