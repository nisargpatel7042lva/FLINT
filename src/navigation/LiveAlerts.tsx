import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { Flame, Hand, Swords } from 'lucide-react-native';

import { InAppBanner, type BannerContent } from '../components';
import { useSocial } from '../hooks';
import { onForegroundNudge } from '../services/messaging';
import { getSocialRepository } from '../services/socialRepositoryProvider';
import { useTheme } from '../theme';
import { navigationRef } from './ref';

/**
 * Pop-ups for things that happen while the app is open.
 *
 * Two sources, one banner:
 *   - nudges and challenges, straight from the Firestore inbox listener, so
 *     they appear the instant they are sent — no server needed;
 *   - pushes from the server (steals, "ran past you") that Android would
 *     otherwise swallow while the app is in front.
 * Only things that arrive after the app opened pop up; older ones wait in
 * Notifications.
 */
export function LiveAlerts() {
  const theme = useTheme();
  const { received, nameFor } = useSocial();
  const [queue, setQueue] = useState<BannerContent[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const openedAt = useRef(new Date().toISOString());

  const push = useCallback((b: BannerContent) => {
    // A tap of vibration if the phone allows it. Never worth failing over.
    try {
      Vibration.vibrate(40);
    } catch {
      // No VIBRATE permission, or a device without a motor.
    }
    setQueue(q => (q.some(x => x.key === b.key) ? q : [...q, b]));
  }, []);

  // Anything sent before the app opened is history, not news: it waits in
  // Notifications. Judged by time rather than by "first snapshot", because an
  // inbox that starts empty has no first snapshot to learn from.
  useEffect(() => {
    received.forEach(p => {
      if (seen.current.has(p.id)) {
        return;
      }
      seen.current.add(p.id);
      if (p.read || p.createdAt < openedAt.current) {
        return;
      }
      // The sender's name, fetched before showing: a pop-up from "Someone"
      // is a pop-up nobody answers.
      getSocialRepository()
        .getProfile(p.fromId)
        .catch(() => null)
        .then(profile => {
          const name = profile?.name ?? nameFor(p.fromId);
          push({
            key: p.id,
            title: `${name} ${p.kind === 'challenge' ? 'challenged you' : 'nudged you'}`,
            body: p.message,
            icon:
              p.kind === 'challenge' ? (
                <Swords color={theme.colors.accent} size={22} />
              ) : (
                <Hand color={theme.colors.accent} size={22} />
              ),
          });
        });
    });
  }, [received, nameFor, push, theme.colors.accent]);

  // Server pushes that land while the app is open.
  useEffect(
    () =>
      onForegroundNudge(n =>
        push({
          key: `fcm_${Date.now()}`,
          title: n.title,
          body: n.body,
          icon: <Flame color={theme.colors.accent} size={22} />,
        }),
      ),
    [push, theme.colors.accent],
  );

  const current = queue[0] ?? null;
  const next = useCallback(() => setQueue(q => q.slice(1)), []);

  return (
    <InAppBanner
      content={current}
      onDismiss={next}
      onPress={() => {
        next();
        if (navigationRef.isReady()) {
          navigationRef.navigate('Notifications');
        }
      }}
    />
  );
}
