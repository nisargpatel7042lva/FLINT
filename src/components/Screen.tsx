import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme, type SpacingKey } from '../theme';

export type ScreenProps = {
  children?: React.ReactNode;
  /** Wrap the content in a ScrollView. */
  scroll?: boolean;
  /** Horizontal page gutter. */
  padding?: SpacingKey;
  /** Which insets to apply. Bottom is off by default so tab bars can own it. */
  edges?: readonly Edge[];
  /** Override the page background — defaults to `colors.background`. */
  backgroundColor?: string;
  /** Force the status bar style; inferred from the theme mode otherwise. */
  statusBarStyle?: 'light-content' | 'dark-content';
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Page shell: background, safe-area insets, status bar and gutter in one place
 * so no screen has to re-derive them.
 */
export function Screen({
  children,
  scroll = false,
  padding = 'lg',
  edges = ['top'],
  backgroundColor,
  statusBarStyle,
  contentContainerStyle,
  style,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const bg = backgroundColor ?? theme.colors.background;

  const insetStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const gutter: ViewStyle = { paddingHorizontal: theme.spacing[padding] };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: bg }, insetStyle, style]}>
      <StatusBar
        barStyle={
          statusBarStyle ?? (theme.mode === 'dark' ? 'light-content' : 'dark-content')
        }
        backgroundColor="transparent"
        translucent
      />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[gutter, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, gutter, contentContainerStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
});
