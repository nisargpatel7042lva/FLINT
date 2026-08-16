import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type EmptyStateProps = {
  title: string;
  body?: string;
  /** A lucide icon element. */
  icon?: React.ReactNode;
  /** Usually a `Button`. */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * NEW PATTERN (Phase 3): empty state.
 *
 * Groups, feeds and review queues are all empty on day one, and an empty
 * screen with no explanation reads as a bug.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
  style,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={[styles.root, style]}>
      {icon ? (
        <View
          style={[
            styles.icon,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.pill,
            },
          ]}>
          {icon}
        </View>
      ) : null}
      <Text variant="h2" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="bodySm" tone="muted" align="center" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  icon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  body: { marginTop: 8, maxWidth: 320 },
  action: { marginTop: 20 },
});
