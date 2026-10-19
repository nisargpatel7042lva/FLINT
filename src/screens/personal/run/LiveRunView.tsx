import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Pause, Play, Square } from 'lucide-react-native';

import { Button, HoldButton, IconButton, Text } from '../../../components';
import { formatDuration, formatPace, type TrackSummary } from '../../../services';
import { useTheme } from '../../../theme';

type Props = {
  summary: TrackSummary;
  elapsed: number;
  kcal: number;
  paused: boolean;
  kind: 'run' | 'walk';
  onTogglePause: () => void;
  onFinish: () => void;
  /** Leaves the screen; the run keeps recording. */
  onMinimise: () => void;
};

/**
 * The run, while it is happening.
 *
 * Everything on a scrolling page is unreadable at arm's length mid-stride, so
 * this is one number, as big as the screen allows, on a colour you can see out
 * of the corner of your eye: accent while moving, plain while paused. Pausing
 * is a tap; finishing is a hold, so a pocket cannot end a run.
 */
export function LiveRunView({
  summary,
  elapsed,
  kcal,
  paused,
  kind,
  onTogglePause,
  onFinish,
  onMinimise,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const bg = paused ? theme.colors.background : theme.colors.accent;
  const tone = paused ? 'default' : 'onAccent';
  const muted = paused ? 'muted' : 'onAccent';

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}>
      <View style={styles.top}>
        <IconButton
          accessibilityLabel="Hide, keep recording"
          variant={paused ? 'muted' : 'dark'}
          size="md"
          onPress={onMinimise}>
          <ChevronDown color={paused ? theme.colors.text : theme.colors.textInverse} size={20} />
        </IconButton>
        <Text variant="label" tone={muted} uppercase>
          {paused ? 'Paused' : kind === 'run' ? 'Running · screen can lock' : 'Walking · screen can lock'}
        </Text>
      </View>

      <View style={styles.centre}>
        <Text variant="hero" tone={tone} accessibilityLabel={`${summary.distanceKm.toFixed(2)} kilometres`}>
          {summary.distanceKm.toFixed(2)}
        </Text>
        <Text variant="h2" tone={muted} style={styles.unit}>
          kilometres
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Time" value={formatDuration(elapsed)} tone={tone} muted={muted} />
        <Stat label="Pace" value={formatPace(summary.paceMinPerKm).replace(' /km', '')} tone={tone} muted={muted} />
        <Stat label="Kcal" value={String(kcal)} tone={tone} muted={muted} />
      </View>

      <View style={styles.controls}>
        {paused ? (
          <>
            <Button
              label="Resume"
              size="lg"
              fullWidth
              onPress={onTogglePause}
              iconLeft={<Play color={theme.colors.onAccent} size={18} />}
            />
            <HoldButton
              label="Hold to finish"
              onComplete={onFinish}
              icon={<Square color={theme.colors.text} size={16} />}
              style={styles.finish}
            />
          </>
        ) : (
          <IconButton
            accessibilityLabel="Pause"
            variant="dark"
            size="lg"
            onPress={onTogglePause}
            style={styles.pause}>
            <Pause color={theme.colors.textInverse} size={28} />
          </IconButton>
        )}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone: 'default' | 'onAccent';
  muted: 'muted' | 'onAccent';
}) {
  return (
    <View style={styles.stat}>
      <Text variant="statMd" tone={tone}>
        {value}
      </Text>
      <Text variant="label" tone={muted} uppercase style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  centre: { flex: 1, justifyContent: 'center' },
  unit: { marginTop: -6 },
  stats: { flexDirection: 'row', marginBottom: 32 },
  stat: { flex: 1 },
  statLabel: { marginTop: 2, opacity: 0.85 },
  controls: { alignItems: 'center', rowGap: 12 },
  pause: { width: 88, height: 88, borderRadius: 44 },
  finish: { alignSelf: 'stretch' },
});
