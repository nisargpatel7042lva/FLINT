import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { cellBounds, frontier, type ExploredCells } from '../services/exploration';
import { useTheme } from '../theme';
import { Text } from './Text';

export type ExploredMapProps = {
  cells: ExploredCells;
  /** Cells uncovered by the session just finished, drawn brighter. */
  fresh?: string[];
  height?: number;
  /** Draw the unexplored ring at the edges. */
  showFrontier?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PAD = 10;
const WIDTH = 320;

/**
 * The ground you have covered, drawn as the cells you uncovered.
 *
 * Not a map, deliberately: street tiles need a keyed provider that bills per
 * view. What this draws is the SHAPE of somebody's exploration — and that turns
 * out to be the recognisable part. People pick out their own commute, the park
 * they loop, the one road they always turn back at.
 *
 * Three tones carry the whole idea:
 *   fresh      what today added
 *   explored   ground already held
 *   frontier   the unexplored cells touching it — the invitation
 */
export function ExploredMap({
  cells,
  fresh = [],
  height = 220,
  showFrontier = true,
  style,
}: ExploredMapProps) {
  const theme = useTheme();

  const geometry = useMemo(() => {
    const ids = Object.keys(cells);
    if (ids.length === 0) {
      return null;
    }

    const edge = showFrontier ? frontier(cells) : [];
    const freshSet = new Set(fresh);

    // Every drawn cell, so the viewport includes the frontier ring rather than
    // clipping it at the border of explored ground.
    const drawn = [...ids, ...edge].map(id => ({
      id,
      bounds: cellBounds(id),
      kind: freshSet.has(id) ? 'fresh' : cells[id] ? 'explored' : 'frontier',
    }));

    const minLat = Math.min(...drawn.map(c => c.bounds.minLat));
    const maxLat = Math.max(...drawn.map(c => c.bounds.maxLat));
    const minLon = Math.min(...drawn.map(c => c.bounds.minLon));
    const maxLon = Math.max(...drawn.map(c => c.bounds.maxLon));

    /*
     * One scale for both axes, with the cosine correction longitude already
     * carries in the grid — otherwise a city's exploration comes out stretched
     * sideways and stops looking like the place it is.
     */
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const spanX = Math.max((maxLon - minLon) * Math.cos(midLat), 1e-9);
    const spanY = Math.max(maxLat - minLat, 1e-9);

    const box = { w: WIDTH - PAD * 2, h: height - PAD * 2 };
    const scale = Math.min(box.w / spanX, box.h / spanY);
    const offsetX = PAD + (box.w - spanX * scale) / 2;
    const offsetY = PAD + (box.h - spanY * scale) / 2;

    const rects = drawn.map(c => {
      const x = offsetX + (c.bounds.minLon - minLon) * Math.cos(midLat) * scale;
      // SVG y grows downward; latitude grows north, so it is flipped.
      const y = offsetY + (maxLat - c.bounds.maxLat) * scale;
      const w = (c.bounds.maxLon - c.bounds.minLon) * Math.cos(midLat) * scale;
      const h = (c.bounds.maxLat - c.bounds.minLat) * scale;
      return { id: c.id, kind: c.kind, x, y, w, h };
    });

    return { rects };
  }, [cells, fresh, height, showFrontier]);

  const fill = (kind: string) => {
    switch (kind) {
      case 'fresh':
        return theme.colors.accent;
      case 'explored':
        return theme.colors.accentSoft ?? theme.colors.surfaceMuted;
      default:
        return theme.colors.surfaceMuted;
    }
  };

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
        <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${height}`}>
          {geometry.rects.map(r => (
            <Rect
              key={r.id}
              x={r.x}
              y={r.y}
              // A hairline overdraw closes the seams between adjacent cells, so
              // continuous ground reads as one shape rather than a tiled floor.
              width={r.w + 0.6}
              height={r.h + 0.6}
              rx={1}
              fill={fill(r.kind)}
              opacity={r.kind === 'frontier' ? 0.35 : 1}
            />
          ))}
        </Svg>
      ) : (
        <View style={styles.empty}>
          <Text variant="bodySm" tone="muted" align="center">
            Track a run or a walk and the ground you cover fills in here.
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
