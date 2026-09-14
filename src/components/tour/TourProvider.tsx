import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { TourOverlay } from './TourOverlay';

export type TourRect = { x: number; y: number; width: number; height: number };

export type TourStep = {
  /** Matches a <TourTarget id="..."> somewhere on screen. */
  target: string;
  title: string;
  body: string;
};

type TourContextValue = {
  active: boolean;
  steps: TourStep[];
  index: number;
  /** Measured position of the current step's target, once it reports one. */
  rect: TourRect | null;
  start: (steps: TourStep[]) => void;
  next: () => void;
  finish: () => void;
  register: (id: string, rect: TourRect) => void;
  unregister: (id: string) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

/**
 * First-run walkthrough.
 *
 * Steps point at REAL elements: a `TourTarget` measures itself in window
 * coordinates and registers the rectangle, and the overlay cuts a hole there.
 * Hard-coding positions would look right on one device and be wrong on every
 * other screen size, and would drift silently the moment a layout changed.
 *
 * Targets that never mount are skipped rather than stalling the tour — a step
 * pointing at something that is not on screen is a dead end for the user.
 */
export function TourProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rects, setRects] = useState<Record<string, TourRect>>({});
  const finishRef = useRef<(() => void) | null>(null);

  const start = useCallback((next: TourStep[]) => {
    setSteps(next);
    setIndex(0);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setIndex(0);
    finishRef.current?.();
  }, []);

  const next = useCallback(() => {
    setIndex(i => {
      if (i + 1 >= steps.length) {
        setActive(false);
        finishRef.current?.();
        return 0;
      }
      return i + 1;
    });
  }, [steps.length]);

  const register = useCallback((id: string, rect: TourRect) => {
    setRects(current => {
      const prev = current[id];
      // Layout fires often; only re-render when the box actually moved.
      if (
        prev &&
        Math.abs(prev.x - rect.x) < 1 &&
        Math.abs(prev.y - rect.y) < 1 &&
        Math.abs(prev.width - rect.width) < 1 &&
        Math.abs(prev.height - rect.height) < 1
      ) {
        return current;
      }
      return { ...current, [id]: rect };
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setRects(current => {
      if (!(id in current)) {
        return current;
      }
      const copy = { ...current };
      delete copy[id];
      return copy;
    });
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      active,
      steps,
      index,
      rect: steps[index] ? rects[steps[index].target] ?? null : null,
      start,
      next,
      finish,
      register,
      unregister,
    }),
    [active, steps, index, rects, start, next, finish, register, unregister],
  );

  /*
   * The overlay is mounted HERE rather than by whichever screen starts the
   * tour.
   *
   * A screen-level overlay is clipped to that screen, so it could never cover
   * the tab bar — the walkthrough dimmed the page and left the navigation
   * fully lit and tappable underneath it. Mounting it above the navigator
   * covers everything, and means no screen has to remember to render it.
   */
  return (
    <TourContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <TourOverlay />
      </View>
    </TourContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used inside a <TourProvider>.');
  }
  return ctx;
}

/**
 * Wraps an element so the tour can point at it.
 *
 * Measurement is deferred to the next frame after layout: on Android the
 * window-relative position is not settled inside onLayout itself, and reading
 * it there yields a rectangle that is offset by the header.
 */
export function TourTarget({
  id,
  children,
  style,
}: PropsWithChildren<{ id: string; style?: StyleProp<ViewStyle> }>) {
  const { register, unregister } = useTour();
  const ref = useRef<View>(null);

  const onLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      requestAnimationFrame(() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            register(id, { x, y, width, height });
          }
        });
      });
    },
    [id, register],
  );

  React.useEffect(() => () => unregister(id), [id, unregister]);

  return (
    <View ref={ref} onLayout={onLayout} style={style} collapsable={false}>
      {children}
    </View>
  );
}
