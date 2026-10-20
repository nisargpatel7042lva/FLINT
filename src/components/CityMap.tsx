import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Minus, Plus, LocateFixed } from 'lucide-react-native';

import { cellBounds, cellFor, type CellId } from '../services/exploration';
import { TILE_PX, project, tilesFor, unproject } from '../services/mercator';
import { Text } from './Text';
import { IconButton } from './IconButton';
import { useTheme } from '../theme';

export type LatLon = { latitude: number; longitude: number };

export type MapCell = {
  cell: CellId;
  colour: string;
  /** 'lit' blocks glow; 'ember' blocks are last week's, burnt out. */
  kind: 'lit' | 'ember';
  /** My club's blocks are drawn brighter, so "ours" reads at a glance. */
  mine?: boolean;
};

export type CityMapProps = {
  centre: LatLon;
  cells: MapCell[];
  selected?: CellId | null;
  onTapCell?: (cell: CellId) => void;
  /** Where the viewer is, if known. */
  me?: LatLon | null;
  /**
   * A route to draw over the blocks — the viewer's own run, from the phone.
   * Each inner array is one stretch; pauses are gaps, never lines.
   */
  route?: LatLon[][];
  /** Starting zoom; 15 shows a neighbourhood, 16 a few streets. */
  initialZoom?: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Dark street tiles: Esri's Dark Gray Canvas, base plus a street-name layer.
 *
 * Served without a key today, which is what a beta needs. A public launch
 * should move to an ArcGIS Location Platform key (its free tier covers
 * millions of tiles a month) — appending `?token=` here is the only change.
 * CARTO's dark tiles, the obvious alternative, now refuse requests without a
 * key and return a watermark instead.
 */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const BASE_URL = (z: number, x: number, y: number) =>
  `${ESRI}/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
const LABEL_URL = (z: number, x: number, y: number) =>
  `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/${z}/${y}/${x}`;
const ATTRIBUTION = 'Powered by Esri · © OpenStreetMap contributors, HERE, Garmin';

const MIN_ZOOM = 12;
/** Dark Gray Canvas stops at 16. */
const MAX_ZOOM = 16;
/** Neighbourhood scale: a 120 m block is ~30 px across. */
const START_ZOOM = 15;

/**
 * How far past the screen the map is drawn, in screens.
 *
 * Panning moves a pre-drawn canvas rather than re-rendering per frame, so the
 * canvas has to reach beyond the edges. When a pan ends it is re-centred.
 */
const OVERDRAW = 1;

/**
 * The city, lit.
 *
 * A slippy map built from plain image tiles plus an SVG overlay, rather than a
 * native map SDK: no API key, no billing account, no native dependency to keep
 * in step with React Native — and the overlay is the whole feature anyway.
 */
export function CityMap({
  centre,
  cells,
  selected,
  onTapCell,
  me,
  route,
  initialZoom = START_ZOOM,
  height,
  style,
}: CityMapProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(initialZoom);
  /** World-pixel centre the canvas is drawn around. */
  const [anchor, setAnchor] = useState(() => project(centre.latitude, centre.longitude, initialZoom));
  const panned = useRef(false);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // Follow the centre we are given (the first GPS fix) until the user pans.
  useEffect(() => {
    if (!panned.current) {
      setAnchor(project(centre.latitude, centre.longitude, zoom));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre.latitude, centre.longitude]);

  // The new anchor and the zeroed pan must land together, or the map jumps.
  useLayoutEffect(() => {
    tx.value = 0;
    ty.value = 0;
  }, [anchor, tx, ty]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const canvasW = width * (1 + 2 * OVERDRAW);
  const canvasH = height * (1 + 2 * OVERDRAW);
  /** World pixel at the canvas's top-left corner. */
  const originX = anchor.x - canvasW / 2;
  const originY = anchor.y - canvasH / 2;

  const tiles = useMemo(
    () => (width > 0 ? tilesFor(originX, originY, canvasW, canvasH, zoom) : []),
    [originX, originY, canvasW, canvasH, zoom, width],
  );

  const rects = useMemo(() => {
    if (width === 0) {
      return [];
    }
    return cells
      .map(c => {
        const b = cellBounds(c.cell);
        const tl = project(b.maxLat, b.minLon, zoom);
        const br = project(b.minLat, b.maxLon, zoom);
        return {
          ...c,
          x: tl.x - originX,
          y: tl.y - originY,
          w: Math.max(1, br.x - tl.x),
          h: Math.max(1, br.y - tl.y),
        };
      })
      .filter(r => r.x + r.w >= 0 && r.y + r.h >= 0 && r.x <= canvasW && r.y <= canvasH);
  }, [cells, zoom, originX, originY, canvasW, canvasH, width]);

  const selectedRect = rects.find(r => r.cell === selected);

  const routePaths = useMemo(
    () =>
      (route ?? [])
        .filter(seg => seg.length > 1)
        .map(seg =>
          seg
            .map((p, i) => {
              const xy = project(p.latitude, p.longitude, zoom);
              return `${i === 0 ? 'M' : 'L'}${(xy.x - originX).toFixed(1)},${(xy.y - originY).toFixed(1)}`;
            })
            .join(' '),
        ),
    [route, zoom, originX, originY],
  );
  const meXY = me ? project(me.latitude, me.longitude, zoom) : null;

  const commitPan = useCallback(
    (dx: number, dy: number) => {
      panned.current = true;
      setAnchor(a => ({ x: a.x - dx, y: a.y - dy }));
    },
    [],
  );

  const tapAt = useCallback(
    (x: number, y: number, dx: number, dy: number) => {
      if (!onTapCell || width === 0) {
        return;
      }
      const wx = anchor.x - width / 2 + x - dx;
      const wy = anchor.y - height / 2 + y - dy;
      const p = unproject(wx, wy, zoom);
      onTapCell(cellFor(p.latitude, p.longitude));
    },
    [onTapCell, anchor, width, height, zoom],
  );

  const pan = Gesture.Pan()
    .minDistance(4)
    .onUpdate(e => {
      'worklet';
      // Never past the drawn canvas, or the edge of the world shows.
      tx.value = Math.max(-width * OVERDRAW, Math.min(width * OVERDRAW, e.translationX));
      ty.value = Math.max(-height * OVERDRAW, Math.min(height * OVERDRAW, e.translationY));
    })
    .onEnd(() => {
      'worklet';
      runOnJS(commitPan)(tx.value, ty.value);
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(e => {
      'worklet';
      runOnJS(tapAt)(e.x, e.y, tx.value, ty.value);
    });

  const gesture = Gesture.Race(pan, tap);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const setZoomKeepingCentre = (next: number) => {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (z === zoom) {
      return;
    }
    // Zoom about the middle of the screen, wherever the user has panned to.
    const mid = unproject(anchor.x - tx.value, anchor.y - ty.value, zoom);
    setZoom(z);
    setAnchor(project(mid.latitude, mid.longitude, z));
  };

  const recentre = () => {
    const c = me ?? centre;
    panned.current = false;
    setAnchor(project(c.latitude, c.longitude, zoom));
  };

  return (
    <View
      style={[styles.frame, { height, backgroundColor: MAP_BG }, style]}
      onLayout={onLayout}>
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill}>
            <Animated.View
              style={[
                styles.canvas,
                { width: canvasW, height: canvasH, left: -width * OVERDRAW, top: -height * OVERDRAW },
                canvasStyle,
              ]}>
              {tiles.map(t => (
                <Image
                  key={t.key}
                  source={{ uri: BASE_URL(t.z, t.x, t.y) }}
                  style={[
                    styles.tile,
                    { left: t.x * TILE_PX - originX, top: t.y * TILE_PX - originY },
                  ]}
                  fadeDuration={0}
                />
              ))}
              <Svg width={canvasW} height={canvasH} style={StyleSheet.absoluteFill}>
                {rects.map(r =>
                  r.kind === 'ember' ? (
                    <Rect
                      key={r.cell}
                      x={r.x + 1}
                      y={r.y + 1}
                      width={r.w - 2}
                      height={r.h - 2}
                      fill={EMBER}
                      fillOpacity={0.18}
                      stroke={EMBER}
                      strokeOpacity={0.55}
                      strokeWidth={1}
                    />
                  ) : (
                    <Rect
                      key={r.cell}
                      x={r.x + 0.5}
                      y={r.y + 0.5}
                      width={r.w - 1}
                      height={r.h - 1}
                      fill={r.colour}
                      fillOpacity={r.mine ? 0.62 : 0.4}
                      stroke={r.colour}
                      strokeOpacity={0.95}
                      strokeWidth={r.mine ? 1.5 : 1}
                    />
                  ),
                )}
                {selectedRect ? (
                  <Rect
                    x={selectedRect.x - 1}
                    y={selectedRect.y - 1}
                    width={selectedRect.w + 2}
                    height={selectedRect.h + 2}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                  />
                ) : null}
                {routePaths.map((d, i) => (
                  <React.Fragment key={`route${i}`}>
                    <Path d={d} stroke="#000000" strokeOpacity={0.5} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d={d} stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </React.Fragment>
                ))}
                {meXY ? (
                  <>
                    <Circle cx={meXY.x - originX} cy={meXY.y - originY} r={11} fill="#FFFFFF" fillOpacity={0.18} />
                    <Circle
                      cx={meXY.x - originX}
                      cy={meXY.y - originY}
                      r={5.5}
                      fill={theme.colors.accent}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  </>
                ) : null}
              </Svg>
              {/* Street names over the light, so a lit block still says where it is. */}
              {tiles.map(t => (
                <Image
                  key={`l${t.key}`}
                  source={{ uri: LABEL_URL(t.z, t.x, t.y) }}
                  style={[
                    styles.tile,
                    { left: t.x * TILE_PX - originX, top: t.y * TILE_PX - originY },
                  ]}
                  fadeDuration={0}
                />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}

      <View style={styles.controls} pointerEvents="box-none">
        <IconButton
          accessibilityLabel="Zoom in"
          variant="dark"
          size="sm"
          onPress={() => setZoomKeepingCentre(zoom + 1)}>
          <Plus color="#FFFFFF" size={18} />
        </IconButton>
        <IconButton
          accessibilityLabel="Zoom out"
          variant="dark"
          size="sm"
          onPress={() => setZoomKeepingCentre(zoom - 1)}>
          <Minus color="#FFFFFF" size={18} />
        </IconButton>
        <IconButton accessibilityLabel="Back to my area" variant="dark" size="sm" onPress={recentre}>
          <LocateFixed color="#FFFFFF" size={18} />
        </IconButton>
      </View>

      <Text variant="caption" style={styles.attribution}>
        {ATTRIBUTION}
      </Text>
    </View>
  );
}

/** The basemap's own background, so unloaded tiles do not flash. */
const MAP_BG = '#242424';
const EMBER = '#B45309';

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  canvas: { position: 'absolute' },
  tile: { position: 'absolute', width: TILE_PX, height: TILE_PX },
  controls: { position: 'absolute', right: 12, top: 12, rowGap: 8 },
  attribution: {
    position: 'absolute',
    left: 8,
    bottom: 4,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
  },
});
