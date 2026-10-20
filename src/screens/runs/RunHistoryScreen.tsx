import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, ChevronRight, Flag, MapPin } from 'lucide-react-native';

import { Card, EmptyState, IconButton, Screen, SectionHeader, Text } from '../../components';
import {
  formatDuration,
  formatPaceSec,
  loadRuns,
  runPaceSec,
  weekStartKey,
  type RunRecord,
} from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const weekLabel = (start: string) => {
  const d = new Date(`${start}T00:00:00`);
  return `Week of ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

/**
 * Every run, newest first, grouped by week. Tap one to see where it went.
 *
 * Read from the phone, where every run is kept with its route — including
 * runs that did not count for the club, marked as such rather than hidden.
 */
export function RunHistoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [runs, setRuns] = useState<RunRecord[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadRuns()
        .then(r => alive && setRuns(r))
        .catch(() => alive && setRuns([]));
      return () => {
        alive = false;
      };
    }, []),
  );

  const weeks = useMemo(() => {
    const by = new Map<string, RunRecord[]>();
    (runs ?? []).forEach(r => {
      const w = weekStartKey(r.day);
      by.set(w, [...(by.get(w) ?? []), r]);
    });
    return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [runs]);

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
        Your runs
      </Text>

      {runs !== null && runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          body="Your runs land here with their route, the moment you finish."
          icon={<MapPin color={theme.colors.textMuted} size={26} />}
        />
      ) : null}

      {weeks.map(([week, list]) => {
        const km = list.filter(r => !r.flagged).reduce((s, r) => s + r.distanceKm, 0);
        return (
          <View key={week}>
            <SectionHeader
              title={weekLabel(week)}
              subtitle={`${km.toFixed(1)} km · ${list.length} run${list.length === 1 ? '' : 's'}`}
              style={styles.section}
            />
            <View style={styles.list}>
              {list.map(r => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('RunDetail', { runId: r.id })}>
                  <Card variant="light" padding="base" radius="xl">
                    <View style={styles.row}>
                      <View style={styles.flex}>
                        <Text variant="bodyStrong">
                          {r.distanceKm.toFixed(2)} km {r.kind === 'walk' ? 'walk' : 'run'}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {new Date(r.startedAt).toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          · {formatDuration(r.durationSec)}
                          {runPaceSec(r) !== null ? ` · ${formatPaceSec(runPaceSec(r))} /km` : ''}
                          {r.litBlocks ? ` · ${r.litBlocks} blocks` : ''}
                        </Text>
                        {r.flagged ? (
                          <View style={styles.flag}>
                            <Flag color={theme.colors.textMuted} size={12} />
                            <Text variant="caption" tone="muted">
                              Didn't count for the club
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <ChevronRight color={theme.colors.textMuted} size={18} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  title: { marginTop: 20 },
  section: { marginTop: 24 },
  list: { marginTop: 10, rowGap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  flex: { flex: 1 },
  flag: { flexDirection: 'row', alignItems: 'center', columnGap: 4, marginTop: 4 },
});
