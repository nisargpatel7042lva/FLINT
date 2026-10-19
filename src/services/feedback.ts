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
export const APP_BUILD = 2;

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
