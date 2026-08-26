import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { Text } from './Text';
import type { GeoPoint, Segment } from '../services/location';

export type RouteMapProps = {
  segments: Segment[];
  height?: number;
  /** Draw start/end markers. Off while recording, on for a finished session. */
  showMarkers?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PAD = 14;

/**
 * The shape of a route, drawn from its own coordinates.
 *
 * Deliberately not a map: tiles need a keyed provider, and every one of them
 * bills per view. The trace is the part people actually recognise — "that's my
 * loop round the park" — so it is drawn on its own, and a real basemap can slot
 * in underneath later without this component's contract changing.
 *
 * Each segment is its own path, so a pause leaves a gap instead of a shortcut.
 */
export function RouteMap({
  segments,
  height = 200,
  showMarkers = true,
  style,
}: RouteMapProps) {
  const theme = useTheme();

  const drawn = useMemo(() => segments.filter(s => s.length > 1), [segments]);

  const geometry = useMemo(() => {
    const all = drawn.flat();
    if (all.length < 2) {
      return null;
    }

    const lats = all.map(p => p.latitude);
    const lons = all.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    /*
     * Equirectangular with a cosine correction on longitude.
     *
     * A degree of longitude is shorter than a degree of latitude everywhere
     * but the equator; without the correction a route drawn at 22°N comes out
     * noticeably stretched sideways and stops looking like the road you ran.
     */
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const spanX = Math.max((maxLon - minLon) * Math.cos(midLat), 1e-6);
    const spanY = Math.max(maxLat - minLat, 1e-6);

    // One scale for both axes keeps the aspect ratio true.
    const width = 320;
    const box = { w: width - PAD * 2, h: height - PAD * 2 };
    const scale = Math.min(box.w / spanX, box.h / spanY);
    const offsetX = PAD + (box.w - spanX * scale) / 2;
    const offsetY = PAD + (box.h - spanY * scale) / 2;

    const project = (p: GeoPoint) => ({
      x: offsetX + (p.longitude - minLon) * Math.cos(midLat) * scale,
      // SVG y grows downward; latitude grows north, so it is flipped.
      y: offsetY + (maxLat - p.latitude) * scale,
    });

    const paths = drawn.map(seg =>
      seg
        .map((p, i) => {
          const { x, y } = project(p);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' '),
    );

    const first = project(drawn[0][0]);
    const lastSeg = drawn[drawn.length - 1];
    const last = project(lastSeg[lastSeg.length - 1]);

    return { paths, width, first, last };
  }, [drawn, height]);

  return (
    <View
      style={[
        styles.wrap,
        {
          height,
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.xl,
        },
        style,
      ]}>
      {geometry ? (
        <Svg width="100%" height="100%" viewBox={`0 0 ${geometry.width} ${height}`}>
          {geometry.paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={theme.colors.accent}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {showMarkers ? (
            <>
              <Circle
                cx={geometry.first.x}
                cy={geometry.first.y}
                r={6}
                fill={theme.colors.surface}
                stroke={theme.colors.accent}
                strokeWidth={3}
              />
              <Circle
                cx={geometry.last.x}
                cy={geometry.last.y}
                r={6}
                fill={theme.colors.accent}
              />
            </>
          ) : null}
        </Svg>
      ) : (
        <View style={styles.empty}>
          <Text variant="bodySm" tone="muted" align="center">
            Waiting for GPS. The route draws itself as you move.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', justifyContent: 'center' },
  empty: { paddingHorizontal: 28 },
});
