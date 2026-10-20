import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import { isFirebaseConfigured, requireFirebase } from './backend';
import { ensureSignedIn } from './auth';

/**
 * The beta's version, shown on reports and in the profile.
 *
 * Kept in step with `versionName` in android/app/build.gradle. A report that
 * does not say which build it came from cannot be acted on.
 */
export const APP_VERSION = '0.1.0';
export const APP_BUILD = 3;

export type FeedbackKind = 'bug' | 'idea' | 'other';

/** "Xiaomi Redmi Note 12 · Android 14" — what a bug report needs, nothing more. */
export function deviceLabel(): string {
  if (Platform.OS !== 'android') {
    return `${Platform.OS} ${String(Platform.Version)}`;
  }
  const c = Platform.constants as { Brand?: string; Model?: string; Release?: string };
  const brand = c.Brand ? c.Brand[0].toUpperCase() + c.Brand.slice(1) : 'Android';
  const model = c.Model ?? '';
  return `${brand} ${model} · Android ${c.Release ?? String(Platform.Version)}`
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

/**
 * Sends a report. Throws if it could not be sent, so the screen can say so
 * rather than thanking somebody for a report that never arrived.
 */
export async function sendFeedback(input: {
  message: string;
  kind: FeedbackKind;
  screen: string;
}): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Not connected');
  }
  const { uid } = await ensureSignedIn();
  await addDoc(collection(getFirestore(requireFirebase()), 'feedback'), {
    uid,
    message: input.message.trim().slice(0, 2000),
    kind: input.kind,
    screen: input.screen.slice(0, 60),
    appVersion: `${APP_VERSION} (${APP_BUILD})`,
    device: deviceLabel(),
    createdAt: serverTimestamp(),
  });
}

/** The short machine code of a Firebase error, e.g. `permission-denied`. */
export function errorCode(e: unknown): string {
  const raw = String((e as { code?: string } | null)?.code ?? '');
  return raw.replace(/^[a-z]+\//, '') || 'unknown';
}

/**
 * A failure a tester hit but did not report, reported for them.
 *
 * Only the step and the error code — never what they typed — so the team sees
 * "join failed: permission-denied" without anyone having to describe it.
 * Best effort: a failure to report is not shown to anyone.
 */
export function reportFailure(screen: string, step: string, e: unknown): void {
  sendFeedback({
    kind: 'bug',
    screen,
    message: `auto: ${step} failed: ${errorCode(e)}`,
  }).catch(() => {});
}

/** What to tell the person, by error code. */
export function friendlyError(e: unknown, action: string): string {
  switch (errorCode(e)) {
    case 'unavailable':
    case 'network-request-failed':
    case 'deadline-exceeded':
      return `No connection. ${action} needs the internet — try again when you're online.`;
    case 'permission-denied':
    case 'unauthenticated':
      return `Flint's server refused this (${errorCode(e)}). We've been sent a report; try again in a minute.`;
    default:
      return `${action} failed (${errorCode(e)}). We've been sent a report; try again in a minute.`;
  }
}
