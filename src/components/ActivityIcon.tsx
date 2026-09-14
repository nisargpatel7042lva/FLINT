import React from 'react';
import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Medal,
  Mountain,
  Snowflake,
  Sparkles,
  Timer,
  Trophy,
  Waves,
  Wind,
  Zap,
  type LucideProps,
} from 'lucide-react-native';

import type { ActivityKind } from '../services/types';

/**
 * The icon for an activity.
 *
 * Exists because every activity was drawn with the same bullseye. Thirty-four
 * identical rows is a list you have to READ rather than scan, and an icon that
 * never changes is worse than no icon at all — it takes the space of a signal
 * and carries none.
 *
 * Not every one of the thirty-four gets a unique glyph; lucide has no rowing
 * machine and inventing one is not worth it. Kinds that share a shape share an
 * icon, chosen so the groups stay meaningful (everything on water, everything
 * on snow) rather than defaulting to a catch-all.
 */
const ICONS: Record<ActivityKind, React.ComponentType<LucideProps>> = {
  run: Footprints,
  trail_running: Mountain,
  walk: Footprints,
  hiking: Mountain,
  cycle: Bike,
  mountain_biking: Bike,

  swim: Waves,
  kayaking: Waves,
  paddleboarding: Waves,
  surfing: Waves,

  rowing: Activity,
  elliptical: Activity,
  stairmaster: Activity,

  hiit: Zap,
  jump_rope: Zap,

  weights: Dumbbell,
  bodyweight: Dumbbell,
  powerlifting: Dumbbell,
  olympic_lifting: Dumbbell,
  crossfit: Flame,

  yoga: Sparkles,
  pilates: Sparkles,
  stretching: Wind,
  foam_rolling: Wind,
  mobility_drills: Timer,

  basketball: Trophy,
  soccer: Trophy,
  tennis: Trophy,
  volleyball: Trophy,
  boxing: Medal,
  martial_arts: Medal,

  climbing: Mountain,
  skiing: Snowflake,
  snowboarding: Snowflake,
};

export type ActivityIconProps = {
  kind: ActivityKind;
  color: string;
  size?: number;
};

export function ActivityIcon({ kind, color, size = 20 }: ActivityIconProps) {
  // `Heart` rather than a bullseye for anything unmapped: a new kind should
  // still look like exercise while somebody picks it a proper glyph.
  const Icon = ICONS[kind] ?? Heart;
  return <Icon color={color} size={size} />;
}
