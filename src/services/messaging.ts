import { PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

import { isFirebaseConfigured, requireFirebase } from './backend';
import { getRepository } from './repositoryProvider';

/**
 * Cloud Messaging.
 *
 * The device token is stored on the user's profile document so a Cloud
 * Function can nudge them without maintaining a separate token registry.
 *
 * Notification COPY is not written here — it lives in `notificationCopy.ts`
 * (client) and `functions/src/copy.ts` (server) so Char's voice has one home.
 */

/** Android 13+ requires a runtime permission before any notification shows. */
async function requestAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isFirebaseConfigured()) {
    return false;
  }

  const androidOk = await requestAndroidPermission();
  if (!androidOk) {
    return false;
  }

  const status = await requestPermission(getMessaging(requireFirebase()));
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Registers this device for nudges. Safe to call on every launch — writes are
 * merged, so a repeat call is a no-op.
 */
export async function registerForNudges(userId: string): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }

  const messaging = getMessaging(requireFirebase());
  const token = await getToken(messaging);
  await getRepository().upsertProfile(userId, { fcmToken: token });

  // Tokens rotate; a stale one silently stops all nudges.
  onTokenRefresh(messaging, next => {
    getRepository()
      .upsertProfile(userId, { fcmToken: next })
      .catch(() => {});
  });

  return token;
}

/** Foreground messages do not raise a system notification — surface them in-app. */
export function onForegroundNudge(
  handler: (nudge: { title: string; body: string }) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    return () => {};
  }
  return onMessage(getMessaging(requireFirebase()), async message => {
    const title = message.notification?.title ?? String(message.data?.title ?? '');
    const body = message.notification?.body ?? String(message.data?.body ?? '');
    if (title || body) {
      handler({ title, body });
    }
  });
}

/**
 * Must be registered at module scope, outside any component — the JS context
 * is spun up fresh for a background message and React has not mounted.
 * Called from index.js.
 */
export function registerBackgroundHandler() {
  if (!isFirebaseConfigured()) {
    return;
  }
  setBackgroundMessageHandler(getMessaging(requireFirebase()), async () => {
    // The payload carries a `notification` block, so the system tray handles
    // display. Nothing to do here yet beyond acknowledging delivery.
  });
}
