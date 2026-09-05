import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Target, Users, CheckCircle2, XCircle } from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  Screen,
  Text,
} from '../../components';
import { ACTIVITY_LABELS, type OneOnOneChallenge } from '../../services/types';
import { getLocalDay } from '../../services/challenges';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

// Mock challenge loaded by token
const MOCK_CHALLENGE: OneOnOneChallenge = {
  id: 'ch1',
  type: 'one_on_one',
  title: '30-day Run Challenge',
  inviteToken: 'ABC123XY',
  activityKind: 'run',
  creatorId: 'u1',
  targetDays: 30,
  sessionsPerDay: 1,
  status: 'pending',
  createdAt: '2026-09-01T00:00:00Z',
};

const MOCK_CREATOR = {
  id: 'u1',
  name: 'Alex Chen',
  handle: '@alex',
};

/**
 * Accept or decline a 1:1 challenge invite.
 * Loads challenge by token and shows preview before acceptance.
 */
export function AcceptChallengeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AcceptChallenge'>>();

  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  // TODO: Load challenge from Firebase by token
  const challenge = MOCK_CHALLENGE;
  const creator = MOCK_CREATOR;

  const handleAccept = () => {
    setAccepting(true);
    
    // TODO: Accept challenge in Firestore
    // - Set opponentId to current user
    // - Set status to 'active'
    // - Set acceptedAt, startDay, endDay
    // - Create group with both users
    
    console.log('Accepting challenge:', challenge.id);
    
    setTimeout(() => {
      setAccepting(false);
      setAccepted(true);
      
      // Navigate to challenge detail after 1.5s
      setTimeout(() => {
        navigation.replace('ChallengeDetail', { challengeId: challenge.id });
      }, 1500);
    }, 800);
  };

  const handleDecline = () => {
    setDeclined(true);
    setTimeout(() => {
      navigation.goBack();
    }, 1000);
  };

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
          {creator.name} challenges you
        </Text>
        
        <Text variant="body" tone="inverseMuted" style={styles.inviteSubtitle}>
          {creator.handle}
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
