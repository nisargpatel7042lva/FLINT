import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import {
  ArrowLeft,
  Check,
  Clock,
  MapPin,
  RotateCcw,
  Video,
} from 'lucide-react-native';

import {
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  MeterBar,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import { DAILY_MEMBER_CAP, effortPoints } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type CaptureState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'done';

const MAX_SECONDS = 30;

/**
 * Proof submission.
 *
 * Individual logs auto-verify from GPS + timestamp (placeholder checks).
 * Team War submissions require a video clip, which the opposing group verifies.
 *
 * NOTE: no camera module is installed yet — capture and upload are simulated so
 * the full UI can be exercised. Swapping in react-native-vision-camera (or an
 * image picker) only replaces `startCapture`/`upload`.
 */
export function ProofSubmitScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ProofSubmit'>>();
  const isTeamWar = Boolean(route.params?.warId);

  const [workouts, setWorkouts] = useState('1');
  const [distance, setDistance] = useState('5');
  const [kcal, setKcal] = useState('420');
  const [note, setNote] = useState('');

  const [capture, setCapture] = useState<CaptureState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearInterval);
    },
    [],
  );

  const points = effortPoints({
    workouts: Number(workouts) || 0,
    distanceKm: Number(distance) || 0,
    kcal: Number(kcal) || 0,
  });
  const overCap = points > DAILY_MEMBER_CAP;

  const startCapture = () => {
    setCapture('recording');
    setSeconds(0);
    const t = setInterval(() => {
      setSeconds(s => {
        if (s + 1 >= MAX_SECONDS) {
          clearInterval(t);
          setCapture('recorded');
          return MAX_SECONDS;
        }
        return s + 1;
      });
    }, 1000);
    timers.current.push(t);
  };

  const stopCapture = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
    setCapture('recorded');
  };

  const upload = () => {
    setCapture('uploading');
    setProgress(0);
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(t);
          setCapture('done');
          return 100;
        }
        return p + 8;
      });
    }, 120);
    timers.current.push(t);
  };

  const canSubmit = isTeamWar ? capture === 'done' : true;

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
        Log your effort
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        {isTeamWar
          ? 'Team War submissions need a short video, verified by the other group.'
          : 'Verified automatically from GPS and timestamp.'}
      </Text>

      <SectionHeader title="What did you do?" style={styles.section} />
      <View style={styles.fields}>
        <Input
          label="Workouts"
          value={workouts}
          onChangeText={setWorkouts}
          keyboardType="number-pad"
          containerStyle={styles.field}
        />
        <Input
          label="Distance (km)"
          value={distance}
          onChangeText={setDistance}
          keyboardType="decimal-pad"
          containerStyle={styles.field}
        />
        <Input
          label="Calories"
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
          containerStyle={styles.field}
        />
      </View>

      {/* Live points preview, so the cap is never a surprise after the fact. */}
      <Card variant="dark" padding="base" radius="xxl" style={styles.preview}>
        <View style={styles.previewRow}>
          <View>
            <Text variant="label" tone="inverseMuted" uppercase>
              This submission
            </Text>
            <Text variant="statMd" tone="accent">
              {points.toLocaleString()} pts
            </Text>
          </View>
          {overCap ? (
            <Chip label="Over daily cap" variant="accent" />
          ) : (
            <Chip label="Cap" value={`${DAILY_MEMBER_CAP}`} variant="muted" />
          )}
        </View>
        {overCap ? (
          <Text variant="caption" tone="inverseMuted" style={styles.previewNote}>
            Only {DAILY_MEMBER_CAP} pts will count toward your team today.
          </Text>
        ) : null}
      </Card>

      {isTeamWar ? (
        <View>
          <SectionHeader
            title="Video proof"
            subtitle={`Up to ${MAX_SECONDS}s`}
            style={styles.section}
          />

          <Card variant="light" padding="lg" style={styles.capture}>
            {capture === 'idle' ? (
              <View style={styles.captureCenter}>
                <IconButton
                  accessibilityLabel="Record proof"
                  variant="accent"
                  size="lg"
                  onPress={startCapture}>
                  <Video color={theme.colors.onAccent} size={24} />
                </IconButton>
                <Text variant="bodySm" tone="muted" style={styles.captureHint}>
                  Record a short clip of your session
                </Text>
              </View>
            ) : null}

            {capture === 'recording' ? (
              <View style={styles.captureCenter}>
                <Chip label="REC" value={`${seconds}s`} variant="accent" />
                <MeterBar
                  value={seconds}
                  max={MAX_SECONDS}
                  style={styles.captureMeter}
                />
                <Button
                  label="Stop recording"
                  variant="dark"
                  size="sm"
                  onPress={stopCapture}
                  style={styles.captureBtn}
                />
              </View>
            ) : null}

            {capture === 'recorded' ? (
              <View style={styles.captureCenter}>
                <Chip label="Clip ready" value={`${seconds}s`} variant="muted" />
                <View style={styles.captureActions}>
                  <Button
                    label="Retake"
                    variant="outline"
                    size="sm"
                    onPress={startCapture}
                    iconLeft={<RotateCcw color={theme.colors.text} size={16} />}
                  />
                  <Button label="Upload" size="sm" onPress={upload} />
                </View>
              </View>
            ) : null}

            {capture === 'uploading' ? (
              <View style={styles.captureCenter}>
                <Text variant="bodyStrong">Uploading… {Math.min(progress, 100)}%</Text>
                <MeterBar value={progress} style={styles.captureMeter} />
              </View>
            ) : null}

            {capture === 'done' ? (
              <View style={styles.captureCenter}>
                <IconButton accessibilityLabel="Uploaded" variant="accent" size="lg">
                  <Check color={theme.colors.onAccent} size={24} strokeWidth={3} />
                </IconButton>
                <Text variant="bodyStrong" style={styles.captureHint}>
                  Proof uploaded
                </Text>
                <Text variant="caption" tone="muted">
                  Waiting on the opposing group to verify.
                </Text>
              </View>
            ) : null}
          </Card>
        </View>
      ) : (
        <View>
          <SectionHeader title="Auto-verification" style={styles.section} />
          <Card variant="light" padding="base">
            <CheckRow
              icon={<MapPin color={theme.colors.success} size={18} />}
              title="GPS route matched"
              detail="Placeholder — wired to Health Connect later."
            />
            <CheckRow
              icon={<Clock color={theme.colors.success} size={18} />}
              title="Timestamp within window"
              detail="Logged inside today's round."
            />
          </Card>
        </View>
      )}

      <Input
        label="Note (optional)"
        placeholder="How did it go?"
        value={note}
        onChangeText={setNote}
        containerStyle={styles.section}
      />

      <Button
        label={isTeamWar ? 'Submit for verification' : 'Log effort'}
        size="lg"
        fullWidth
        disabled={!canSubmit}
        style={styles.submit}
        onPress={() => navigation.goBack()}
      />
      {isTeamWar && capture !== 'done' ? (
        <Text variant="caption" tone="muted" align="center" style={styles.submitNote}>
          Record and upload a clip to submit.
        </Text>
      ) : null}
    </Screen>
  );
}

function CheckRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.checkRow}>
      {icon}
      <View style={styles.checkCopy}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  section: { marginTop: 28 },
  fields: { marginTop: 12, rowGap: 14 },
  field: {},
  preview: { marginTop: 20 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewNote: { marginTop: 10 },
  capture: { marginTop: 12 },
  captureCenter: { alignItems: 'center', rowGap: 12 },
  captureHint: { marginTop: 4 },
  captureMeter: { marginTop: 4 },
  captureBtn: { marginTop: 4 },
  captureActions: { flexDirection: 'row', columnGap: 10, marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingVertical: 8 },
  checkCopy: { flex: 1 },
  submit: { marginTop: 28 },
  submitNote: { marginTop: 10 },
});
