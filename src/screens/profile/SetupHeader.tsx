import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { IconButton, PageDots, Text } from '../../components';
import { useTheme } from '../../theme';

export const SETUP_STEPS = 3;

export type SetupHeaderProps = {
  /** Zero-based step index. */
  step: number;
  title: string;
  subtitle?: string;
};

/**
 * Shared header for the profile-setup steps.
 *
 * A screen-level composition of existing primitives (IconButton + PageDots +
 * Text), not a new visual pattern — it exists purely so the three steps don't
 * repeat the same markup.
 */
export function SetupHeader({ step, title, subtitle }: SetupHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <View>
      <View style={styles.row}>
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        <PageDots count={SETUP_STEPS} index={step} onDark />
        <Text variant="caption" tone="muted">
          {step + 1} of {SETUP_STEPS}
        </Text>
      </View>

      <Text variant="displaySm" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" tone="muted" style={styles.subtitle}>
          {subtitle}
        </Text>
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
  title: { marginTop: 24 },
  subtitle: { marginTop: 8 },
});
