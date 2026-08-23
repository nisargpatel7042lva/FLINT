import { getApp, getApps } from '@react-native-firebase/app';

/**
 * Whether a real Firebase backend is available.
 *
 * Firebase auto-initialises from `google-services.json` at native start-up. If
 * that file is absent the Gradle plugin is skipped (see android/app/build.gradle)
 * and no default app exists — so `getApps()` is the honest runtime signal for
 * "do we have a backend?".
 *
 * Everything in the data layer routes through this: with Firebase the app reads
 * and writes Firestore; without it, it falls back to local fixtures so the repo
 * stays runnable for anyone who has not been handed credentials.
 */
let cached: boolean | null = null;

export function isFirebaseConfigured(): boolean {
  if (cached !== null) {
    return cached;
  }
  try {
    cached = getApps().length > 0;
  } catch {
    // The native module is missing entirely (e.g. a JS-only test run).
    cached = false;
  }
  return cached;
}

/** Throws a useful message rather than a null-pointer deep inside a query. */
export function requireFirebase() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add android/app/google-services.json and rebuild.',
    );
  }
  return getApp();
}

/** For tests and for forcing the local backend during development. */
export function __setFirebaseConfigured(value: boolean | null) {
  cached = value;
}
