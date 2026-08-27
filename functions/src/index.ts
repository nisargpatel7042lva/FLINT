import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger, setGlobalOptions } from 'firebase-functions';

import { comebackNudge, milestoneNudge, streakAtRiskNudge } from './copy';
import { pokeNudge, seedFrom, type PokeKind } from './pokeCopy';

initializeApp();
const db = getFirestore();

/**
 * Deployment region.
 *
 * MUST match the Firestore database's location. A 2nd-gen Firestore trigger
 * deployed to a different region than its database fails to deploy — and the
 * database location is chosen once, at creation, and can never be changed.
 *
 * Change this line if you picked a different location in the console.
 * `asia-south1` is Mumbai; `us-central1` is the Firebase default.
 */
setGlobalOptions({
  region: 'asia-south1',
  /*
   * A hard ceiling on concurrency, and the only thing standing between a bug
   * and a bill.
   *
   * 2nd-gen functions default to scaling out to 100 instances. Nothing here
   * needs that — a nudge is one small write and one push — and a trigger that
   * accidentally rewrites the document that triggered it would otherwise scale
   * a loop as fast as Google can allocate containers. Ten is far more than the
   * real workload and turns a runaway into a slow queue instead of a bill.
   */
  maxInstances: 10,
});

/** Local-date key. Never toISOString() — see the note in src/services/training.ts. */
const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const shift = (d: Date, delta: number): Date => {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
};

/** Consecutive days ending today or yesterday — mirrors the client rule. */
function computeStreak(days: Set<string>, today: string): number {
  const start = new Date(`${today}T00:00:00`);
  let cursor = days.has(today) ? start : shift(start, -1);
  if (!days.has(dayKey(cursor))) {
    return 0;
  }
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n += 1;
    cursor = shift(cursor, -1);
  }
  return n;
}

const STAGES: { name: string; minStreak: number }[] = [
  { name: 'Ember', minStreak: 0 },
  { name: 'Flame', minStreak: 3 },
  { name: 'Blaze', minStreak: 7 },
  { name: 'Wildfire', minStreak: 21 },
  { name: 'Forge', minStreak: 60 },
];

const stageFor = (streak: number) =>
  [...STAGES].reverse().find(s => streak >= s.minStreak) ?? STAGES[0];

async function send(token: string, nudge: { title: string; body: string }) {
  await getMessaging().send({
    token,
    notification: { title: nudge.title, body: nudge.body },
    android: {
      priority: 'normal',
      notification: { channelId: 'kasrat_streak' },
    },
    data: { title: nudge.title, body: nudge.body },
  });
}

/**
 * Recomputes the user's streak whenever a session is written.
 *
 * The streak lives on the profile so the nudge job does not have to read every
 * user's session history, and because clients are blocked from writing it by
 * the security rules — a streak the client could set is a streak it can fake.
 */
export const onSessionWritten = onDocumentWritten(
  'users/{userId}/sessions/{sessionId}',
  async event => {
    const userId = event.params.userId as string;

    const snap = await db.collection(`users/${userId}/sessions`).get();
    const days = new Set(snap.docs.map(d => String(d.get('day') ?? d.id)));

    const today = dayKey(new Date());
    const streak = computeStreak(days, today);

    const userRef = db.doc(`users/${userId}`);
    const before = (await userRef.get()).get('currentStreak') ?? 0;

    await userRef.set(
      { currentStreak: streak, lastSessionDay: today },
      { merge: true },
    );

    // Celebrate only on the transition into a stage, never repeatedly.
    const crossed = STAGES.find(s => s.minStreak > before && s.minStreak <= streak);
    if (crossed && crossed.minStreak > 0) {
      const token = (await userRef.get()).get('fcmToken');
      if (token) {
        await send(String(token), milestoneNudge(streak, crossed.name));
      }
    }

    logger.info('streak recomputed', { userId, before, streak });
  },
);

/**
 * Evening nudge for streaks that are alive but have nothing logged today.
 *
 * Runs once at 19:00. Deliberately NOT a countdown to midnight: pressure is
 * exactly the tone Char is supposed to avoid.
 *
 * TODO: 19:00 UTC is the wrong hour for most of the world. Store an IANA
 * timezone on the profile and shard this job by zone before launch.
 */
export const nudgeStreaksAtRisk = onSchedule(
  { schedule: '0 19 * * *', timeZone: 'Etc/UTC' },
  async () => {
    const today = dayKey(new Date());

    const candidates = await db
      .collection('users')
      .where('currentStreak', '>', 0)
      .get();

    let sent = 0;
    for (const doc of candidates.docs) {
      const token = doc.get('fcmToken');
      const lastDay = doc.get('lastSessionDay');
      const streak = Number(doc.get('currentStreak') ?? 0);

      // Already trained today, or no way to reach them.
      if (!token || lastDay === today) {
        continue;
      }

      // One nudge per day, whatever else happens.
      const lastNudge = doc.get('lastNudgeAt');
      if (lastNudge && dayKey(lastNudge.toDate()) === today) {
        continue;
      }

      try {
        await send(String(token), streakAtRiskNudge(streak, doc.id.length));
        await doc.ref.set({ lastNudgeAt: new Date() }, { merge: true });
        sent += 1;
      } catch (e) {
        logger.warn('nudge failed', { userId: doc.id, error: String(e) });
      }
    }

    logger.info('streak nudges sent', { sent, candidates: candidates.size });
  },
);

/**
 * Weekly, warm re-engagement for people who have drifted.
 *
 * Sends at most one message a week and says nothing about how long they have
 * been away beyond choosing a gentler title past a fortnight.
 */
export const nudgeComebacks = onSchedule(
  { schedule: '0 17 * * SUN', timeZone: 'Etc/UTC' },
  async () => {
    const today = new Date();
    const cutoff = dayKey(shift(today, -4));

    const users = await db.collection('users').where('currentStreak', '==', 0).get();

    let sent = 0;
    for (const doc of users.docs) {
      const token = doc.get('fcmToken');
      const lastDay = doc.get('lastSessionDay');
      if (!token || !lastDay || String(lastDay) > cutoff) {
        continue;
      }

      const daysAway = Math.round(
        (today.getTime() - new Date(`${lastDay}T00:00:00`).getTime()) / 86400000,
      );

      try {
        await send(String(token), comebackNudge(daysAway, doc.id.length));
        sent += 1;
      } catch (e) {
        logger.warn('comeback nudge failed', { userId: doc.id, error: String(e) });
      }
    }

    logger.info('comeback nudges sent', { sent });
  },
);

/**
 * Delivers a person-to-person nudge.
 *
 * This is the whole point of the feature: without it a nudge is a row in a
 * database that the recipient only sees if they happen to open the app.
 *
 * Three things are deliberate here:
 *
 *  - The push text is generated from `kind` and the sender's display NAME, and
 *    the `message` the client wrote is ignored. Client-supplied text on a
 *    stranger's lock screen is a harassment vector, not a feature.
 *  - The sender's name comes from their public profile, not from the nudge
 *    document, so it cannot be spoofed by writing a different name into the
 *    poke.
 *  - A token that Firebase reports as dead is cleared. Stale tokens otherwise
 *    accumulate forever and every send burns quota failing.
 *
 * The once-per-day cap is NOT enforced here: the nudge's document id encodes
 * sender, recipient, kind and day, and the rules permit create only, so a
 * second one cannot exist to trigger this.
 */
export const onPokeCreated = onDocumentCreated('pokes/{pokeId}', async event => {
  const snap = event.data;
  if (!snap) {
    return;
  }

  const pokeId = event.params.pokeId as string;
  const fromUid = String(snap.get('fromUid') ?? '');
  const toUid = String(snap.get('toUid') ?? '');
  const kind = String(snap.get('kind') ?? 'poke') as PokeKind;

  if (!fromUid || !toUid || fromUid === toUid) {
    logger.warn('poke ignored: malformed', { pokeId });
    return;
  }

  const [senderProfile, recipient] = await Promise.all([
    db.doc(`profiles/${fromUid}`).get(),
    db.doc(`users/${toUid}`).get(),
  ]);

  const token = recipient.get('fcmToken');
  if (!token) {
    // Not an error: plenty of people never grant notification permission. The
    // nudge still shows in-app the next time they open it.
    logger.info('poke stored but not pushed: no token', { pokeId });
    return;
  }

  const senderName = String(senderProfile.get('name') ?? 'A friend');
  const nudge = pokeNudge(kind, senderName, seedFrom(pokeId));

  try {
    await send(String(token), nudge);
    logger.info('poke delivered', { pokeId, kind });
  } catch (e) {
    const code = (e as { errorInfo?: { code?: string } })?.errorInfo?.code ?? '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-argument')
    ) {
      await db.doc(`users/${toUid}`).update({ fcmToken: FieldValue.delete() });
      logger.info('cleared dead token', { toUid });
      return;
    }
    logger.warn('poke delivery failed', { pokeId, error: String(e) });
  }
});
