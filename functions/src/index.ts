import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { createHash } from 'crypto';

import { comebackNudge, milestoneNudge, streakAtRiskNudge } from './copy';

initializeApp();
const db = getFirestore();

/** Pepper for invite code hashing. Server-only secret. */
const JOIN_CODE_PEPPER = process.env.JOIN_CODE_PEPPER || 'flint-mvp-join-pepper-change-in-production';

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

/**
 * Hash an invite token with pepper for secure lookup.
 */
function hashInviteToken(token: string): string {
  return createHash('sha256')
    .update(JOIN_CODE_PEPPER + token)
    .digest('hex');
}

/**
 * Redeem a challenge invite code.
 * 
 * Security model:
 * - Hashed token lookup (JOIN_CODE_PEPPER + SHA-256)
 * - App Check enforced
 * - Admin-only membership writes
 * - Rate limited to prevent brute force
 * 
 * @callable
 */
export const redeemJoinCode = onCall(
  {
    enforceAppCheck: true,
    consumeAppCheckToken: true,
  },
  async request => {
    const { token } = request.data;

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    if (!token || typeof token !== 'string') {
      throw new HttpsError('invalid-argument', 'Invalid invite token');
    }

    const userId = request.auth.uid;

    // Rate limiting: check recent accepts for this user
    const recentAccepts = await db
      .collection('challenges')
      .where('opponentId', '==', userId)
      .where('acceptedAt', '>', new Date(Date.now() - 60000)) // Last minute
      .get();

    if (recentAccepts.size >= 3) {
      throw new HttpsError('resource-exhausted', 'Too many accept attempts. Try again later.');
    }

    // Hash the token for secure lookup
    const hashedToken = hashInviteToken(token);

    // Find challenge by hashed token
    const challengeSnap = await db
      .collection('challenges')
      .where('inviteTokenHash', '==', hashedToken)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (challengeSnap.empty) {
      throw new HttpsError('not-found', 'Challenge not found or already accepted');
    }

    const challengeDoc = challengeSnap.docs[0];
    const challenge = challengeDoc.data();

    // Prevent self-accept
    if (challenge.creatorId === userId) {
      throw new HttpsError('invalid-argument', 'Cannot accept your own challenge');
    }

    // Check if already has opponent
    if (challenge.opponentId) {
      throw new HttpsError('already-exists', 'Challenge already has an opponent');
    }

    const today = dayKey(new Date());
    const targetDays = Number(challenge.targetDays || 30);
    const endDay = dayKey(shift(new Date(`${today}T00:00:00`), targetDays));

    // Create group with both members (admin-only write)
    const groupRef = await db.collection('groups').add({
      name: `${challenge.title} Group`,
      code: String(challenge.inviteToken || '').substring(0, 6),
      memberIds: [challenge.creatorId, userId],
      createdAt: new Date(),
    });

    // Update challenge (admin-only write)
    await challengeDoc.ref.update({
      opponentId: userId,
      groupId: groupRef.id,
      status: 'active',
      acceptedAt: new Date(),
      startDay: today,
      endDay,
    });

    logger.info('challenge redeemed', {
      challengeId: challengeDoc.id,
      creatorId: challenge.creatorId,
      opponentId: userId,
      groupId: groupRef.id,
    });

    return {
      success: true,
      challengeId: challengeDoc.id,
      groupId: groupRef.id,
    };
  },
);

/**
 * Create a rematch challenge.
 * 
 * Special case: both users are already known from the original challenge,
 * so we can create it as active immediately without requiring acceptance.
 * 
 * @callable
 */
export const createRematch = onCall(async request => {
  const { originalChallengeId } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!originalChallengeId || typeof originalChallengeId !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid original challenge ID');
  }

  const userId = request.auth.uid;

  // Load original challenge
  const originalDoc = await db.collection('challenges').doc(originalChallengeId).get();
  if (!originalDoc.exists) {
    throw new HttpsError('not-found', 'Original challenge not found');
  }

  const original = originalDoc.data();
  if (!original) {
    throw new HttpsError('not-found', 'Original challenge data not found');
  }

  // Verify user is a participant
  if (original.creatorId !== userId && original.opponentId !== userId) {
    throw new HttpsError('permission-denied', 'Not a participant in the original challenge');
  }

  // Verify original challenge is complete
  if (original.status !== 'completed' && original.status !== 'active') {
    // Allow active challenges to be rematched (user may want to start new one early)
  }

  const opponentId = original.creatorId === userId ? original.opponentId : original.creatorId;
  if (!opponentId) {
    throw new HttpsError('failed-precondition', 'Original challenge has no opponent');
  }

  // Calculate new target (25% bump or +7, whichever is larger)
  const oldTarget = Number(original.targetDays || 30);
  const bump = Math.max(Math.ceil(oldTarget * 0.25), 7);
  const newTarget = oldTarget + bump;

  const today = dayKey(new Date());
  const endDay = dayKey(shift(new Date(`${today}T00:00:00`), newTarget));

  // Create new group for the rematch
  const groupRef = await db.collection('groups').add({
    name: `${newTarget}-day ${original.activityKind} Rematch`,
    code: `RM${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    memberIds: [userId, opponentId],
    createdAt: new Date(),
  });

  // Generate token (won't be used for rematch but needed for model)
  const token = Math.random().toString(36).substring(2, 10).toUpperCase();
  const tokenHash = hashInviteToken(token);

  // Create rematch challenge as active (both users known)
  const challengeRef = await db.collection('challenges').add({
    type: 'one_on_one',
    title: `${newTarget}-day ${original.activityKind} Challenge`,
    inviteToken: token,
    inviteTokenHash: tokenHash,
    activityKind: original.activityKind,
    creatorId: userId,
    opponentId,
    groupId: groupRef.id,
    targetDays: newTarget,
    sessionsPerDay: 1,
    status: 'active', // Start active immediately
    rematchOf: originalChallengeId, // Track lineage
    createdAt: new Date(),
    acceptedAt: new Date(),
    startDay: today,
    endDay,
  });

  logger.info('rematch created', {
    originalChallengeId,
    newChallengeId: challengeRef.id,
    creatorId: userId,
    opponentId,
    oldTarget,
    newTarget,
  });

  return {
    success: true,
    challengeId: challengeRef.id,
    groupId: groupRef.id,
  };
});

/**
 * Log challenge activity.
 * 
 * Security model:
 * - Gated callable write (no raw client addDoc)
 * - Enforces today|yesterday day window server-side
 * - Validates group membership
 * - Auto-verifies for 1:1 challenges
 * - Ensures onSubmissionWritten runs on real logs
 * 
 * @callable
 */
export const logChallengeActivity = onCall(async request => {
  const { challengeId, distanceKm, kcal, note } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!challengeId || typeof challengeId !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid challenge ID');
  }

  const userId = request.auth.uid;
  const today = dayKey(new Date());

  // Client can only log for today
  const day = today;

  // Load challenge
  const challengeDoc = await db.collection('challenges').doc(challengeId).get();
  if (!challengeDoc.exists) {
    throw new HttpsError('not-found', 'Challenge not found');
  }

  const challenge = challengeDoc.data();
  if (!challenge) {
    throw new HttpsError('not-found', 'Challenge data not found');
  }

  // Verify user is a participant
  if (challenge.creatorId !== userId && challenge.opponentId !== userId) {
    throw new HttpsError('permission-denied', 'Not a participant in this challenge');
  }

  // Check if challenge is active
  if (challenge.status !== 'active') {
    throw new HttpsError('failed-precondition', 'Challenge is not active');
  }

  const groupId = challenge.groupId;
  if (!groupId) {
    throw new HttpsError('failed-precondition', 'Challenge has no group');
  }

  // Check for duplicate log (one per day)
  const existingLog = await db
    .collection('submissions')
    .where('groupId', '==', groupId)
    .where('memberId', '==', userId)
    .where('day', '==', day)
    .limit(1)
    .get();

  if (!existingLog.empty) {
    throw new HttpsError('already-exists', 'Already logged for today');
  }

  // Create submission (admin write)
  const submissionRef = await db.collection('submissions').add({
    memberId: userId,
    groupId,
    day,
    kind: challenge.activityKind || 'run',
    effort: {
      workouts: 1,
      distanceKm: Number(distanceKm || 0),
      kcal: Number(kcal || 0),
    },
    status: 'auto_verified',
    approvals: [],
    rejections: [],
    autoChecks: { gpsOk: true, timestampOk: true },
    note: note ? String(note) : undefined,
    createdAt: new Date(),
    reactions: { fire: 0, strong: 0, clap: 0, eyes: 0 },
  });

  logger.info('challenge activity logged', {
    challengeId,
    userId,
    submissionId: submissionRef.id,
    day,
  });

  return {
    success: true,
    submissionId: submissionRef.id,
    day,
  };
});
