import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { counter } from '../theme';
import { Text, type TextProps } from './Text';

export type AnimatedCounterProps = Omit<TextProps, 'children'> & {
  value: number;
  /** Rendered before the number, e.g. "+". */
  prefix?: string;
  suffix?: string;
  /** Override the tween length. Clamped to `counter.maxDuration`. */
  durationMs?: number;
  style?: StyleProp<TextStyle>;
};

/**
 * Implements rule 3 of `theme/motion.ts`: counters increment smoothly rather
 * than snapping.
 *
 * Driven on the JS thread with requestAnimationFrame rather than Reanimated,
 * because the animated quantity is text content — Reanimated can only drive
 * that through an AnimatedProps/TextInput trick, which costs more than it saves
 * for the small, infrequent numbers this renders (streaks, points earned).
 */
export function AnimatedCounter({
  value,
  prefix,
  suffix,
  durationMs,
  ...textProps
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (from === to) {
      return;
    }

    const ms = Math.min(durationMs ?? counter.duration, counter.maxDuration);
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / ms, 1);
      // Ease-out cubic: fast start, gentle landing, matching easing.decelerate.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      fromRef.current = to;
    };
  }, [value, durationMs]);

  return (
    <Text {...textProps}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </Text>
  );
}
