import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Check, Play, X } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Screen,
  Text,
} from '../../components';
import {
  REQUIRED_APPROVALS,
  effortPoints,
  memberById,
  pendingForReview,
} from '../../services';
import { useTheme } from '../../theme';

type Verdict = 'approved' | 'rejected';

/**
 * Opponent verification queue.
 *
 * Verification is the social mechanic: the opposing group approves submissions
 * before they score. Decisions are local-only until the backend lands.
 */
export function ProofReviewScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [queue] = useState(() => pendingForReview());
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  const remaining = queue.filter(s => !verdicts[s.id]);

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>
        <Chip label="Queue" value={`${remaining.length}`} variant="muted" />
      </View>

      <Text variant="displaySm" style={styles.title}>
        Verify proof
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        Their submissions don’t score until {REQUIRED_APPROVALS} of you approve.
      </Text>

      {remaining.length === 0 ? (
        <EmptyState
          title="Queue clear"
          body="Nothing waiting on you. Their points are counted."
          icon={<Check color={theme.colors.success} size={26} />}
          action={<Button label="Back to the war" onPress={() => navigation.goBack()} />}
          style={styles.empty}
        />
      ) : (
        <View style={styles.list}>
          {remaining.map(s => {
            const m = memberById(s.memberId);
            return (
              <Card key={s.id} variant="light" padding="base">
                <View style={styles.postHead}>
                  <Avatar name={m.name} size="md" />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{m.name}</Text>
                    <Text variant="caption" tone="muted">
                      {s.kind} · {s.effort.distanceKm} km · {s.effort.kcal} kcal
                    </Text>
                  </View>
                  <Text variant="statSm" tone="muted">
                    {effortPoints(s.effort)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.media,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderRadius: theme.radius.lg,
                    },
                  ]}>
                  <IconButton accessibilityLabel="Play proof" variant="dark" size="md">
                    <Play
                      color={theme.colors.textInverse}
                      size={18}
                      fill={theme.colors.textInverse}
                    />
                  </IconButton>
                </View>

                <View style={styles.actions}>
                  <Button
                    label="Reject"
                    variant="outline"
                    size="sm"
                    style={styles.action}
                    onPress={() =>
                      setVerdicts(v => ({ ...v, [s.id]: 'rejected' }))
                    }
                    iconLeft={<X color={theme.colors.text} size={16} />}
                  />
                  <Button
                    label={`Approve (${s.approvals.length}/${REQUIRED_APPROVALS})`}
                    size="sm"
                    style={styles.action}
                    onPress={() =>
                      setVerdicts(v => ({ ...v, [s.id]: 'approved' }))
                    }
                    iconLeft={<Check color={theme.colors.onAccent} size={16} />}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  empty: { marginTop: 24 },
  list: { marginTop: 20, rowGap: 12 },
  postHead: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  media: { height: 120, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', columnGap: 10, marginTop: 14 },
  action: { flex: 1 },
});
