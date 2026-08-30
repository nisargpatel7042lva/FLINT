import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { IconButton, PageDots } from '../../components';
import { FLOW_LENGTH, flowIndex, type FlowStep } from '../../services';
import { useTheme } from '../../theme';

export type FlowHeaderProps = {
  step: FlowStep;
};

/**
 * Progress across the opening flow.
 *
 * Deliberately just dots and a back arrow — no "2 of 4" counter. The dots say
 * "this is short" at a glance, which is the only thing somebody needs to know
 * here; a number invites them to work out how much is left, which is the
 * feeling this flow exists to avoid.
 *
 * The back arrow matters more than it looks. Every screen in this flow asks a
 * question about the person, and a question you cannot take back is a question
 * people answer defensively or abandon.
 */
export function FlowHeader({ step }: FlowHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <View style={styles.row}>
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>
      <PageDots count={FLOW_LENGTH} index={flowIndex(step)} onDark />
      {/* Balances the arrow so the dots sit on the screen's centre line. */}
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  spacer: { width: 44 },
});
