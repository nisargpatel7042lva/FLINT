import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { Logo, Text } from '../../../components';
import { cellBounds, formatDuration, formatPace, type CellId } from '../../../services';

type Props = {
  width: number;
  cells: CellId[];
  colour: string;
  clubName: string | null;
  distanceKm: number;
  durationSec: number;
  paceMinPerKm: number | null;
  date: Date;
};

/** 4:5 — the shape Instagram and WhatsApp status both show uncropped. */
const ASPECT = 5 / 4;

/**
 * The run, as something worth posting.
 *
 * Every shared card is the cheapest advert Flint will ever get, so it shows
 * the one thing no other running app shows: the blocks this run lit, in the
 * club's colour. It never shows the route — only blocks that were already
 * trimmed for privacy — so a post cannot lead anyone to the runner's door.
 */
export const RunShareCard = forwardRef<ViewShotRef, Props>(function ShareCard(
  { width, cells, colour, clubName, distanceKm, durationSec, paceMinPerKm, date },
  ref,
) {
  const height = Math.round(width * ASPECT);
  const mapH = Math.round(height * 0.5);
  const mapW = width - 48;

  const rects = useMemo(() => {
    if (cells.length === 0) {
      return [];
    }
    const bounds = cells.map(cellBounds);
    const minLat = Math.min(...bounds.map(b => b.minLat));
    const maxLat = Math.max(...bounds.map(b => b.maxLat));
    const minLon = Math.min(...bounds.map(b => b.minLon));
    const maxLon = Math.max(...bounds.map(b => b.maxLon));
    // Longitude shrinks with latitude; correct it so blocks stay square.
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (maxLon - minLon) * k;
    const spanY = maxLat - minLat;
    // A short run lights two or three blocks; blown up to fill the card they
    // stop reading as blocks of a city. Never draw one wider than a sixth.
    const blockSpan = bounds[0].maxLat - bounds[0].minLat;
    const scale = Math.min(mapW / spanX, mapH / spanY, mapW / 6 / blockSpan);
    const offX = (mapW - spanX * scale) / 2;
    const offY = (mapH - spanY * scale) / 2;
    return bounds.map((b, i) => ({
      key: cells[i],
      x: offX + (b.minLon - minLon) * k * scale,
      y: offY + (maxLat - b.maxLat) * scale,
      w: Math.max(2, (b.maxLon - b.minLon) * k * scale - 2),
      h: Math.max(2, (b.maxLat - b.minLat) * scale - 2),
    }));
  }, [cells, mapW, mapH]);

  const n = cells.length;

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
      <View style={[styles.card, { width, height }]}>
        <View style={styles.top}>
          <View style={styles.brand}>
            <Logo size={22} />
            <Text variant="label" tone="accent" uppercase>
              Flint
            </Text>
          </View>
          <Text variant="caption" tone="inverseMuted">
            {date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </View>

        <View style={[styles.map, { height: mapH }]}>
          {rects.length > 0 ? (
            <Svg width={mapW} height={mapH}>
              {rects.map(r => (
                <Rect
                  key={r.key}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={2}
                  fill={colour}
                  fillOpacity={0.75}
                  stroke={colour}
                  strokeWidth={1}
                />
              ))}
            </Svg>
          ) : (
            <Text variant="hero" tone="inverse">
              {distanceKm.toFixed(2)}
            </Text>
          )}
        </View>

        <View>
          <Text variant="displayMd" tone="inverse">
            {n > 0 ? `Lit ${n} block${n === 1 ? '' : 's'}` : `${distanceKm.toFixed(2)} km run`}
          </Text>
          {n > 0 ? (
            <Text variant="h3" style={[styles.club, { color: colour }]}>
              {clubName ? `for ${clubName}` : 'of the city'}
            </Text>
          ) : null}
          <View style={styles.stats}>
            <Stat value={`${distanceKm.toFixed(2)} km`} label="Distance" />
            <Stat value={formatDuration(durationSec)} label="Time" />
            <Stat value={formatPace(paceMinPerKm).replace(' /km', '')} label="Pace /km" />
          </View>
        </View>

        <Text variant="caption" tone="inverseMuted" style={styles.footer}>
          Light up your city · use-flint.vercel.app
        </Text>
      </View>
    </ViewShot>
  );
});

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="statSm" tone="inverse">
        {value}
      </Text>
      <Text variant="caption" tone="inverseMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0B0B0C',
    borderRadius: 28,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  map: { alignItems: 'center', justifyContent: 'center' },
  club: { marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: 16 },
  stat: { flex: 1 },
  footer: { marginTop: 12 },
});
