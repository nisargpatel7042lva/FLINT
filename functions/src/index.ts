import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

import { comebackNudge, milestoneNudge, streakAtRiskNudge } from './copy';

initializeApp();
const db = getFirestore();

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
 * Compute challenge streaks when a submission is created or updated.
 * 
 * Challenge streaks are server-owned to prevent client forgery.
 * Consecutive days in device-local timezone, miss = break.
 */
export const onSubmissionWritten = onDocumentWritten(
  'submissions/{submissionId}',
  async event => {
    const submission = event.data?.after.data();
    if (!submission) {
      return;
    }

    const { groupId, memberId } = submission;

    // Check if this submission belongs to a 1:1 challenge
    const challengeSnap = await db
      .collection('challenges')
      .where('groupId', '==', groupId)
      .where('type', '==', 'one_on_one')
      .limit(1)
      .get();

    if (challengeSnap.empty) {
      return; // Not a challenge submission
    }

    const challenge = challengeSnap.docs[0];
    const challengeId = challenge.id;

    // Get all submissions for this user in this challenge
    const userSubs = await db
      .collection('submissions')
      .where('groupId', '==', groupId)
      .where('memberId', '==', memberId)
      .where('status', '!=', 'rejected')
      .get();

    const days = new Set<string>();
    userSubs.docs.forEach(doc => {
      const day = doc.get('day');
      if (day) {
        days.add(String(day));
      }
    });

    const today = dayKey(new Date());
    const totalActiveDays = days.size;

    // Compute current streak (consecutive days ending today or yesterday)
    let currentStreak = 0;
    const todayDate = new Date(`${today}T00:00:00`);
    const yesterday = dayKey(shift(todayDate, -1));
    let cursor = days.has(today) ? today : yesterday;

    if (days.has(cursor)) {
      while (days.has(cursor)) {
        currentStreak += 1;
        cursor = dayKey(shift(new Date(`${cursor}T00:00:00`), -1));
      }
    }

    // Compute best streak
    const sortedDays = Array.from(days).sort();
    let bestStreak = 0;
    let tempStreak = 1;

    for (let i = 1; i < sortedDays.length; i++) {
      const prevDate = new Date(`${sortedDays[i - 1]}T00:00:00`);
      const expectedNext = dayKey(shift(prevDate, 1));

      if (sortedDays[i] === expectedNext) {
        tempStreak += 1;
      } else {
        bestStreak = Math.max(bestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);

    const lastActivityDay = sortedDays[sortedDays.length - 1];

    // Write the computed streak
    const streakRef = db.doc(`challengeStreaks/${challengeId}_${memberId}`);
    await streakRef.set(
      {
        challengeId,
        userId: memberId,
        currentStreak,
        bestStreak,
        lastActivityDay,
        totalActiveDays,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    logger.info('challenge streak computed', {
      challengeId,
      userId: memberId,
      currentStreak,
      bestStreak,
      totalActiveDays,
    });
  },
);
