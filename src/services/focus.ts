import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The doom-scroll check, and the push-up counter it sends you to.
 *
 * Both are Android-only native features (see android/.../focus). Where the
 * native module is missing — tests, iOS — every call is a harmless no-op and
 * the push-up screen falls back to tap-to-count.
 */

type NativeFocus = {
  getStatus: () => Promise<{ enabled: boolean; hasUsageAccess: boolean }>;
  setEnabled: (enabled: boolean, savage: boolean) => Promise<boolean>;
  openUsageAccessSettings: () => Promise<boolean>;
  hasProximity: () => Promise<boolean>;
  startProximity: () => Promise<boolean>;
  stopProximity: () => Promise<boolean>;
  setKeepAwake: (on: boolean) => Promise<boolean>;
};

const native: NativeFocus | undefined =
  Platform.OS === 'android' ? NativeModules.FlintFocus : undefined;

export type ScrollCheckStatus = { enabled: boolean; hasUsageAccess: boolean };

export async function getScrollCheck(): Promise<ScrollCheckStatus> {
  return native ? native.getStatus() : { enabled: false, hasUsageAccess: false };
}

export async function setScrollCheck(enabled: boolean, savage: boolean): Promise<void> {
  await native?.setEnabled(enabled, savage);
}

export async function openUsageAccess(): Promise<boolean> {
  return native ? native.openUsageAccessSettings() : false;
}

// ── Push-up counting ───────────────────────────────────────────────────────

/**
 * Counts reps from a stream of near/far readings.
 *
 * Phone flat on the floor under your chest: the proximity sensor reads
 * "near" as you go down and "far" as you push up. A rep is one full cycle,
 * counted on the way down. Anything faster than [MIN_REP_MS] is the sensor
 * flickering, not a person — nobody does two push-ups in a third of a second.
 */
export const MIN_REP_MS = 350;

export function createRepCounter(onRep: (reps: number) => void) {
  let reps = 0;
  let near = false;
  let lastRepAt = 0;
  return {
    reading(isNear: boolean, at: number) {
      if (isNear && !near && at - lastRepAt >= MIN_REP_MS) {
        reps += 1;
        lastRepAt = at;
        onRep(reps);
      }
      near = isNear;
    },
    /** A manual tap — chin or nose on the screen — counts the same. */
    tap(at: number) {
      if (at - lastRepAt >= MIN_REP_MS) {
        reps += 1;
        lastRepAt = at;
        onRep(reps);
      }
    },
    get reps() {
      return reps;
    },
  };
}

/** Listens to the proximity sensor; returns a stop function, or null if there is none. */
export async function watchProximity(onNear: (near: boolean) => void): Promise<(() => void) | null> {
  if (!native || !(await native.hasProximity())) {
    return null;
  }
  const emitter = new NativeEventEmitter(NativeModules.FlintFocus);
  const sub = emitter.addListener('FlintProximity', (e: { near: boolean }) => onNear(e.near));
  await native.startProximity();
  return () => {
    sub.remove();
    native.stopProximity().catch(() => {});
  };
}

/** Screen stays on while true. Pair every `true` with a `false`. */
export async function keepAwake(on: boolean): Promise<void> {
  await native?.setKeepAwake(on).catch(() => false);
}

// ── Records ────────────────────────────────────────────────────────────────

export type PushupSet = { reps: number; seconds: number; at: string };

const KEY = 'flint.pushups.v1';

export async function loadPushups(): Promise<PushupSet[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PushupSet[]) : [];
  } catch {
    return [];
  }
}

export async function savePushups(set: PushupSet): Promise<PushupSet[]> {
  const all = [set, ...(await loadPushups())].slice(0, 500);
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
  return all;
}

/** Best single set, and today's total — the two numbers worth beating. */
export function pushupStats(sets: PushupSet[], today: string) {
  return {
    best: sets.reduce((m, s) => Math.max(m, s.reps), 0),
    today: sets.filter(s => s.at.slice(0, 10) === today).reduce((t, s) => t + s.reps, 0),
  };
}
