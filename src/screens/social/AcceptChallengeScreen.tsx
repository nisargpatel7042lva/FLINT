import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Target, Users, CheckCircle2, XCircle } from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  Screen,
  Text,
} from '../../components';
import { ACTIVITY_LABELS } from '../../services/types';
import { getLocalDay } from '../../services/challenges';
import { useChallengeByToken, useAcceptChallenge } from '../../hooks/useChallenges';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

/**
 * Accept or decline a 1:1 challenge invite.
 * Loads challenge by token and shows preview before acceptance.
 */
export function AcceptChallengeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AcceptChallenge'>>();
  
  const { challenge, loading: loadingChallenge, error: loadError } = useChallengeByToken(route.params.token);
  const { accept, accepting } = useAcceptChallenge();

  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  const handleAccept = async () => {
    if (!challenge) return;
    
    try {
      const result = await accept(route.params.token);
      setAccepted(true);
      
      // Navigate to challenge detail immediately after state update
      // Use a brief delay just for the success message to be visible
      setTimeout(() => {
        navigation.replace('ChallengeDetail', { challengeId: result.challengeId });
      }, 800);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to accept challenge',
      );
    }
  };

  const handleDecline = () => {
    setDeclined(true);
    // Navigate immediately - no need for setTimeout
    navigation.goBack();
  };

  // Loading state
  if (loadingChallenge) {
    return (
      <Screen padding="lg" center>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text variant="body" tone="muted" style={styles.loadingText}>
          Loading challenge...
        </Text>
      </Screen>
    );
  }

  // Error state
  if (loadError || !challenge) {
    return (
      <Screen padding="lg" center>
        <XCircle color={theme.colors.danger} size={64} />
        <Text variant="displaySm" style={styles.statusTitle}>
          Challenge not found
        </Text>
        <Text variant="body" tone="muted" style={styles.statusBody}>
          This invite link may be invalid or expired.
        </Text>
        <Button
          label="Go back"
          size="md"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </Screen>
    );
  }

  // Challenge already accepted
  if (challenge.status !== 'pending') {
    return (
      <Screen padding="lg" center>
        <Text variant="displaySm" style={styles.statusTitle}>
          Challenge already started
        </Text>
        <Text variant="body" tone="muted" style={styles.statusBody}>
          This challenge has already been accepted.
        </Text>
        <Button
          label="View challenge"
          size="md"
          onPress={() => navigation.replace('ChallengeDetail', { challengeId: challenge.id })}
          style={styles.backButton}
        />
      </Screen>
    );
  }

  if (accepted) {
    return (
      <Screen padding="lg" center>
        <View style={styles.statusContainer}>
          <CheckCircle2 color={theme.colors.success} size={64} />
          <Text variant="displaySm" style={styles.statusTitle}>
            Challenge accepted!
          </Text>
          <Text variant="body" tone="muted" style={styles.statusBody}>
            The streak starts today. Don't break it.
          </Text>
        </View>
      </Screen>
    );
  }

  if (declined) {
    return (
      <Screen padding="lg" center>
        <View style={styles.statusContainer}>
          <XCircle color={theme.colors.textMuted} size={64} />
          <Text variant="displaySm" style={styles.statusTitle}>
            Declined
          </Text>
          <Text variant="body" tone="muted" style={styles.statusBody}>
            Maybe next time.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <Card variant="dark" padding="lg" style={styles.inviteCard}>
        <View style={styles.inviteIcon}>
          <Target color={theme.colors.accent} size={32} />
        </View>
        
        <Text variant="headingLg" tone="inverse" style={styles.inviteTitle}>
          Challenge invitation
        </Text>
        
        <Text variant="body" tone="inverseMuted" style={styles.inviteSubtitle}>
          Someone has challenged you
        </Text>
      </Card>

      <Card variant="light" padding="lg" style={styles.detailsCard}>
        <Text variant="headingMd" style={styles.challengeTitle}>
          {challenge.title}
        </Text>
        
        <View style={styles.meta}>
          <Chip label={ACTIVITY_LABELS[challenge.activityKind]} variant="accent" />
          <Chip label={`${challenge.targetDays} days`} variant="muted" />
        </View>

        <View style={styles.rules}>
          <Text variant="bodyStrong" style={styles.rulesTitle}>
            How it works
          </Text>
          <Rule text={`Log ${ACTIVITY_LABELS[challenge.activityKind]} every day`} />
          <Rule text="Consecutive days build your streak" />
          <Rule text="Miss a day, break the streak" />
          <Rule text={`First to ${challenge.targetDays} days wins`} />
          <Rule text="Or push harder with a rematch" />
        </View>
      </Card>

      <Card variant="accent" padding="base" style={styles.startCard}>
        <View style={styles.startContent}>
          <Users color={theme.colors.onAccent} size={20} />
          <View style={styles.startText}>
            <Text variant="bodyStrong" tone="inverse">
              Starts today
            </Text>
            <Text variant="bodySm" tone="inverseMuted">
              {getLocalDay()} · Streak begins when you accept
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          label="Accept challenge"
          size="lg"
          fullWidth
          loading={accepting}
          disabled={accepting}
          style={styles.acceptButton}
          onPress={handleAccept}
        />
        <Button
          label="Decline"
          size="lg"
          variant="outline"
          fullWidth
          disabled={accepting}
          onPress={handleDecline}
        />
      </View>
    </Screen>
  );
}

function Rule({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.rule}>
      <Text variant="caption" tone="accent">
        •
      </Text>
      <Text variant="bodySm" tone="default" style={styles.ruleText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140, paddingTop: 40 },
  loadingText: { marginTop: 16, textAlign: 'center' },
  backButton: { marginTop: 20 },
  inviteCard: { alignItems: 'center' },
  inviteIcon: { marginBottom: 20 },
  inviteTitle: { textAlign: 'center' },
  inviteSubtitle: { marginTop: 4, textAlign: 'center' },
  detailsCard: { marginTop: 20 },
  challengeTitle: { textAlign: 'center' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: 8,
    marginTop: 12,
  },
  rules: { marginTop: 24 },
  rulesTitle: { marginBottom: 12 },
  rule: { flexDirection: 'row', columnGap: 8, marginTop: 6 },
  ruleText: { flex: 1 },
  startCard: { marginTop: 20 },
  startContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  startText: { flex: 1 },
  actions: { marginTop: 28, rowGap: 12 },
  acceptButton: {},
  statusContainer: { alignItems: 'center' },
  statusTitle: { marginTop: 20, textAlign: 'center' },
  statusBody: { marginTop: 8, textAlign: 'center' },
});
