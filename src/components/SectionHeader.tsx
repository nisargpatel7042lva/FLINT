import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { Text, type TextTone } from './Text';

export type SectionHeaderProps = {
  title: string;
  /** Optional second line under the title. */
  subtitle?: string;
  /** Trailing text action — the "See All" / "Show All" chip. */
  actionLabel?: string;
  onActionPress?: () => void;
  /** Use on dark surfaces so the text flips to the inverse palette. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  onDark = false,
  style,
  testID,
}: SectionHeaderProps) {
  const theme = useTheme();

  const titleTone: TextTone = onDark ? 'inverse' : 'default';
  const subtitleTone: TextTone = onDark ? 'inverseMuted' : 'muted';

  return (
    <View testID={testID} style={[styles.row, style]}>
      <View style={styles.titleBlock}>
        <Text variant="h2" tone={titleTone}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" tone={subtitleTone} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: onDark
                ? theme.colors.surfaceInverseMuted
                : theme.colors.surface,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            },
            pressed ? styles.pressed : null,
          ]}>
          <Text variant="caption" tone={onDark ? 'inverse' : 'default'}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  titleBlock: { flexShrink: 1 },
  subtitle: { marginTop: 2 },
  action: { flexShrink: 0 },
  pressed: { opacity: 0.7 },
});
