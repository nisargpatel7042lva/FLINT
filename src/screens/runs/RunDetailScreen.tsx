import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, Flag } from 'lucide-react-native';

import { Card, CityMap, IconButton, Screen, Text, type MapCell } from '../../components';
import {
  cityCellsForRun,
  clubColour,
  decodeRoute,
  formatDuration,
  formatPaceSec,
  loadRoute,
  loadRuns,
  project,
  runPaceSec,
  type RunRecord,
  type Segment,
} from '../../services';
import { useSocial } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

/** The largest zoom (12–17) at which the whole route fits the map. */
function fitZoom(route: Segment[], width: number, height: number): number {
  const pts = route.flat();
  if (pts.length < 2) {
    return 15;
  }
  for (let z = 17; z > 12; z -= 1) {
    const xy = pts.map(p => project(p.latitude, p.longitude, z));
    const w = Math.max(...xy.map(p => p.x)) - Math.min(...xy.map(p => p.x));
    const h = Math.max(...xy.map(p => p.y)) - Math.min(...xy.map(p => p.y));
    if (w <= width * 0.8 && h <= height * 0.8) {
      return z;
    }
  }
  return 12;
}

/**
 * One run: where it went, on the real streets, and the blocks it lit.
 *
 * The route comes from the phone and is shown only here. The blocks are
 * worked out the same way they were when the run was posted — both ends
 * trimmed — so what is drawn is exactly what the city saw.
 */
export function RunDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'RunDetail'>>();
  const { width } = useWindowDimensions();
  const { groups } = useSocial();

  const [run, setRun] = useState<RunRecord | null>(null);
  const [route, setRoute] = useState<Segment[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadRuns()
      .then(rs => alive && setRun(rs.find(r => r.id === params.runId) ?? null))
      .catch(() => {});
    loadRoute(params.runId)
      .then(enc => alive && setRoute(enc ? decodeRoute(enc) : []))
      .catch(() => alive && setRoute([]));
    return () => {
      alive = false;
    };
  }, [params.runId]);

  const club = groups.find(g => g.kind === 'club');
  const mapH = 360;
  const mapW = width - 48;

  const cells: MapCell[] = useMemo(() => {
    if (!route || run?.flagged) {
      return [];
    }
    const colour = club ? clubColour(club.id) : theme.colors.accent;
    return cityCellsForRun(route).map(cell => ({ cell, colour, kind: 'lit', mine: true }));
  }, [route, run, club, theme.colors.accent]);

  const centre = useMemo(() => {
    const pts = (route ?? []).flat();
    if (pts.length === 0) {
      return null;
    }
    const lats = pts.map(p => p.latitude);
    const lons = pts.map(p => p.longitude);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    };
  }, [route]);

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>

      {run ? (
        <>
          <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
            {new Date(run.startedAt).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <View style={styles.headline}>
            <Text variant="displayLg">{run.distanceKm.toFixed(2)}</Text>
            <Text variant="h2" tone="muted">
              km
            </Text>
          </View>

          <Card variant="dark" padding="base" radius="xxl" style={styles.card}>
            <View style={styles.stats}>
              <Stat label="Time" value={formatDuration(run.durationSec)} />
              <Stat
                label="Pace /km"
                value={formatPaceSec(runPaceSec(run))}
              />
              <Stat label="Blocks" value={String(run.flagged ? 0 : run.litBlocks ?? cells.length)} />
            </View>
          </Card>

          {run.flagged ? (
            <Card variant="light" padding="base" radius="xl" style={styles.card}>
              <View style={styles.row}>
                <Flag color={theme.colors.accent} size={18} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">Didn't count for the club</Text>
                  <Text variant="bodySm" tone="muted">
                    {run.flagged} It is still yours, here.
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}
        </>
      ) : null}

      {centre && route ? (
        <CityMap
          centre={centre}
          cells={cells}
          route={route}
          initialZoom={fitZoom(route, mapW, mapH)}
          height={mapH}
          style={[styles.map, { borderRadius: theme.radius.xxl }]}
        />
      ) : route !== null ? (
        <Card variant="light" padding="base" radius="xl" style={styles.card}>
          <Text variant="bodySm" tone="muted">
            No route saved for this run — it was recorded before Flint kept routes.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="statSm" tone="inverse">
        {value}
      </Text>
      <Text variant="label" tone="inverseMuted" uppercase>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  eyebrow: { marginTop: 20 },
  headline: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, marginTop: 4 },
  card: { marginTop: 14 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, rowGap: 2 },
  row: { flexDirection: 'row', columnGap: 12 },
  flex: { flex: 1 },
  map: { marginTop: 16 },
});
