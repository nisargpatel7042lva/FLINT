import React, { useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';

import {
  Button,
  Card,
  IconButton,
  Input,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import { ACTIVITY_LABELS } from '../../services/types';
import { getLocalDay } from '../../services/challenges';
import { useChallenge, useChallengeStreakForUser } from '../../hooks/useChallenges';
import { useLogChallengeActivity } from '../../hooks/useChallenges';
import { currentUser } from '../../services/auth';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

/**
 * Manual activity log for a challenge.
 * Simple input: distance/time/kcal + optional note.
 */
export function ChallengeLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ChallengeLog'>>();

  const user = currentUser();
  const currentUserId = user?.uid ?? '';

  const { challenge, loading: loadingChallenge } = useChallenge(route.params.challengeId);
  const { streak } = useChallengeStreakForUser(route.params.challengeId, currentUserId);
  const { logActivity, submitting } = useLogChallengeActivity();
  const today = getLocalDay();

  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [kcal, setKcal] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!challenge) return;
    
    try {
      await logActivity(
        challenge.id,
        challenge.activityKind,
        {
          workouts: 1,
          distanceKm: parseFloat(distance) || 0,
          kcal: parseInt(kcal, 10) || 0,
        },
        note || undefined,
      );
      
      setSubmitted(true);

      // Navigate back after brief success message display
      setTimeout(() => {
        navigation.goBack();
      }, 800);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not log activity',
      );
    }
  };

  const canSubmit =
    !submitting &&
    ((distance && parseFloat(distance) > 0) ||
      (duration && parseInt(duration, 10) > 0) ||
      (kcal && parseInt(kcal, 10) > 0));

  if (loadingChallenge) {
    return (
      <Screen padding="lg" center>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text variant="body" tone="muted" style={styles.loadingText}>
          Loading...
        </Text>
      </Screen>
    );
  }

  if (!challenge) {
    return (
      <Screen padding="lg" center>
        <Text variant="displaySm" style={styles.errorTitle}>
          Challenge not found
        </Text>
        <Button label="Go back" onPress={() => navigation.goBack()} style={styles.backButton} />
      </Screen>
    );
  }

  if (submitted) {
    // Show the new streak day after logging
    const newStreakDay = (streak?.currentStreak ?? 0) + 1;
    return (
      <Screen padding="lg" center>
        <View style={styles.successContainer}>
          <CheckCircle2 color={theme.colors.success} size={64} />
          <Text variant="displaySm" style={styles.successTitle}>
            Streak's alive. Day {newStreakDay}.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>

      <Text variant="displaySm" style={styles.title}>
        Log {ACTIVITY_LABELS[challenge.activityKind]}
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {today} · {challenge.title}
      </Text>

      <Card variant="light" padding="base" style={styles.dateCard}>
        <Text variant="bodyStrong">Today's log</Text>
        <Text variant="caption" tone="muted" style={styles.dateNote}>
          Streaks tick at local midnight. One log per day keeps it alive.
        </Text>
      </Card>

      <SectionHeader title="Activity details" style={styles.section} />

      {/* Distance-based activities */}
      {['run', 'walk', 'cycle', 'swim', 'rowing', 'hiking', 'trail_running', 'mountain_biking'].includes(
        challenge.activityKind,
      ) && (
        <Input
          label="Distance (km)"
          placeholder="5.0"
          value={distance}
          onChangeText={setDistance}
          keyboardType="decimal-pad"
          containerStyle={styles.input}
        />
      )}

      <Input
        label="Duration (minutes)"
        placeholder="30"
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        containerStyle={styles.input}
      />

      <Input
        label="Calories burned (optional)"
        placeholder="250"
        value={kcal}
        onChangeText={setKcal}
        keyboardType="number-pad"
        containerStyle={styles.input}
      />

      <SectionHeader title="Add a note (optional)" style={styles.section} />
      <Input
        placeholder="Felt strong today, pushed the pace..."
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        containerStyle={styles.noteInput}
      />

      <Card variant="dark" padding="base" style={styles.autoVerify}>
        <Text variant="bodyStrong" tone="inverse">
          Auto-verified
        </Text>
        <Text variant="bodySm" tone="inverseMuted" style={styles.autoVerifyBody}>
          1:1 challenges auto-verify from device timestamp. No video needed.
        </Text>
      </Card>

      <Button
        label="Submit log"
        size="lg"
        fullWidth
        disabled={!canSubmit}
        loading={submitting}
        style={styles.submit}
        onPress={handleSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  loadingText: { marginTop: 16, textAlign: 'center' },
  errorTitle: { textAlign: 'center' },
  backButton: { marginTop: 20 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 4 },
  dateCard: { marginTop: 20 },
  dateNote: { marginTop: 4 },
  section: { marginTop: 28 },
  input: { marginTop: 12 },
  noteInput: { marginTop: 12 },
  autoVerify: { marginTop: 20 },
  autoVerifyBody: { marginTop: 6 },
  submit: { marginTop: 28 },
  successContainer: { alignItems: 'center' },
  successTitle: { marginTop: 20, textAlign: 'center' },
  successBody: { marginTop: 8, textAlign: 'center' },
});
