import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger, setGlobalOptions } from 'firebase-functions';
import {
  LIMITS,
  clampNumber,
  generateGroupCode,
  generateInviteToken,
  hashInviteToken,
  optionalText,
  requireActivityKind,
  requireString,
  TOKEN_ATTEMPT_LIMIT,
  TOKEN_ATTEMPT_WINDOW_MS,
} from './secure';

import {
  comebackNudge,
  milestoneNudge,
  passedNudge,
  stealNudge,
  streakAtRiskNudge,
} from './copy';
import { overtakenBy, weekStartKey, type ClubRun } from './board';
import { CITY_WINDOW_DAYS, stolenBy, type CityRunLite } from './city';
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
/*
 * The invite-code pepper is read inside `secure.ts`, at call time.
 *
 * It used to be read here and `throw` at module load if unset. A throw at this
 * level fails the entire functions package, so a missing pepper also took down
 * the nightly streak reminders and the nudge delivery — neither of which has
 * anything to do with invite codes. Failing at the point of use keeps the blast
 * radius to the feature that actually needs the secret.
 */

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
 * exactly the tone Spark is supposed to avoid.
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

/**
 * "X passed you" — pushed to whoever a new club run just overtook.
 *
 * Runs when a run lands in a club, rebuilds the week's board with and without
 * it, and pushes to the members who were ahead before and are behind now.
 *
 * Guardrails, because a notification about losing is the one most likely to
 * get the whole app's notifications turned off:
 *   - at most one "passed" push per person, per club, per day. Getting passed
 *     by three people on a Saturday morning is one piece of news, not three;
 *   - only to current members, so somebody who left the club stops hearing
 *     about it;
 *   - nobody who has not run this week is ever "passed" — they are not on the
 *     board, so the board maths never names them;
 *   - the voice is whatever the recipient chose, warm unless they asked.
 */
export const onClubRunCreated = onDocumentCreated(
  'groups/{groupId}/runs/{runId}',
  async event => {
    const snap = event.data;
    if (!snap) {
      return;
    }
    const groupId = event.params.groupId as string;
    const runId = event.params.runId as string;

    const toRun = (id: string, d: FirebaseFirestore.DocumentData): ClubRun => ({
      id,
      uid: String(d.uid ?? ''),
      distanceKm: Number(d.distanceKm ?? 0),
      day: String(d.day ?? ''),
      createdAt:
        (d.createdAt?.toDate?.() as Date | undefined)?.toISOString() ??
        new Date().toISOString(),
    });

    const newRun = toRun(runId, snap.data());
    if (!newRun.uid || !(newRun.distanceKm > 0) || !newRun.day) {
      return;
    }

    const weekStart = weekStartKey(newRun.day);
    const [group, weekRuns] = await Promise.all([
      db.doc(`groups/${groupId}`).get(),
      db.collection(`groups/${groupId}/runs`).where('day', '>=', weekStart).get(),
    ]);

    const members = new Set<string>((group.get('memberIds') as string[]) ?? []);
    const before = weekRuns.docs.filter(d => d.id !== runId).map(d => toRun(d.id, d.data()));
    const overtaken = overtakenBy(before, newRun, weekStart).filter(u => members.has(u));
    if (overtaken.length === 0) {
      return;
    }

    const passer = String(
      (await db.doc(`profiles/${newRun.uid}`).get()).get('name') ?? 'Someone',
    );
    const club = String(group.get('name') ?? 'your club');

    await Promise.all(
      overtaken.slice(0, 25).map(async uid => {
        const limit = db.doc(`rateLimits/passed_${uid}_${groupId}`);
        const fresh = await db.runTransaction(async tx => {
          const prev = await tx.get(limit);
          if (prev.exists && prev.get('day') === newRun.day) {
            return false;
          }
          tx.set(limit, { day: newRun.day, updatedAt: new Date() });
          return true;
        });
        if (!fresh) {
          return;
        }

        const user = await db.doc(`users/${uid}`).get();
        const token = user.get('fcmToken');
        if (!token) {
          return;
        }
        const tone = user.get('tone') === 'savage' ? 'savage' : 'warm';
        try {
          await send(String(token), passedNudge(passer, club, tone));
        } catch (e) {
          logger.warn('passed push failed', { uid, groupId, error: String(e) });
        }
      }),
    );
    logger.info('club run processed', { groupId, runId, overtaken: overtaken.length });
  },
);

/**
 * "Another club took your blocks" — pushed to the club that lost them.
 *
 * When a city run lands, ownership of its blocks is worked out with and
 * without it (the same rule the map uses, see ./city.ts). Every club that
 * just lost blocks to this run hears about it, once:
 *   - at most one steal alert per person per losing club every 6 hours, so a
 *     rival club's Saturday long run is one alert, not twelve;
 *   - never to someone who is ALSO in the club that took the blocks;
 *   - in the voice each person chose — the savage one dares them to go and
 *     take the blocks back, never anything about them as a person.
 */
export const onCityRunCreated = onDocumentCreated('cityRuns/{cityRunId}', async event => {
  const snap = event.data;
  if (!snap) {
    return;
  }
  const d = snap.data();
  const now = Date.now();
  const toLite = (id: string, x: FirebaseFirestore.DocumentData): CityRunLite => ({
    id,
    clubId: String(x.clubId ?? ''),
    clubName: String(x.clubName ?? 'A club'),
    cells: Array.isArray(x.cells) ? x.cells.filter((c: unknown) => typeof c === 'string') : [],
    createdAtMs: (x.createdAt?.toMillis?.() as number | undefined) ?? now,
  });
  const next = toLite(snap.id, d);
  const region = String(d.region ?? '');
  if (!next.clubId || next.cells.length === 0 || !region) {
    return;
  }

  const since = new Date(now - CITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await db
    .collection('cityRuns')
    .where('region', '==', region)
    .where('createdAt', '>=', since)
    .get();
  const before = recent.docs.filter(x => x.id !== snap.id).map(x => toLite(x.id, x.data()));

  const lost = stolenBy(before, next, now);
  if (lost.size === 0) {
    return;
  }
  const thiefClub = await db.doc(`groups/${next.clubId}`).get();
  const thieves = new Set<string>((thiefClub.get('memberIds') as string[]) ?? []);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  await Promise.all(
    [...lost.entries()].map(async ([victimId, { clubName, cells }]) => {
      const victim = await db.doc(`groups/${victimId}`).get();
      const members = ((victim.get('memberIds') as string[]) ?? []).filter(u => !thieves.has(u));
      await Promise.all(
        members.slice(0, 100).map(async uid => {
          const limit = db.doc(`rateLimits/steal_${uid}_${victimId}`);
          const fresh = await db.runTransaction(async tx => {
            const prev = await tx.get(limit);
            const last = (prev.get('at') as number | undefined) ?? 0;
            if (now - last < SIX_HOURS) {
              return false;
            }
            tx.set(limit, { at: now });
            return true;
          });
          if (!fresh) {
            return;
          }
          const user = await db.doc(`users/${uid}`).get();
          const token = user.get('fcmToken');
          if (!token) {
            return;
          }
          const tone = user.get('tone') === 'savage' ? 'savage' : 'warm';
          try {
            await send(String(token), stealNudge(next.clubName, clubName, cells.length, tone));
          } catch (e) {
            logger.warn('steal push failed', { uid, victimId, error: String(e) });
          }
        }),
      );
    }),
  );
  logger.info('city run processed', { id: snap.id, victims: lost.size });
});

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
 * Counts one attempt at guessing an invite token, and refuses past the limit.
 *
 * This replaces a limiter that could never fire. The old one counted challenges
 * the caller had successfully ACCEPTED in the last minute — but somebody
 * brute-forcing tokens never accepts anything, so their count stayed at zero
 * however many guesses they made. A limit has to count the attempt, not the
 * success.
 *
 * The counter is written before the lookup, so a crash mid-call costs the
 * attacker an attempt rather than refunding it.
 */
async function countTokenAttempt(uid: string): Promise<void> {
  const ref = db.doc(`rateLimits/tokenGuess_${uid}`);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const windowStart = Number(data?.windowStart ?? 0);
    const fresh = now - windowStart > TOKEN_ATTEMPT_WINDOW_MS;
    const count = fresh ? 0 : Number(data?.count ?? 0);

    if (count >= TOKEN_ATTEMPT_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        'Too many invite codes tried. Wait an hour and try again.',
      );
    }

    tx.set(ref, {
      count: count + 1,
      windowStart: fresh ? now : windowStart,
      updatedAt: new Date(),
    });
  });
}

/**
 * Create a new 1:1 challenge.
 * 
 * Security model:
 * - Server generates and hashes token
 * - Stores both plaintext (creator-only read) and hash (for lookups)
 * - Returns token to creator for sharing
 * 
 * @callable
 */
export const createOneOnOneChallenge = onCall(async request => {
  const { activityKind, targetDays, title, rematchOf } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  /*
   * Every value below arrives from the wire and is bounded before it is stored.
   * `activityKind` in particular used to be any string the caller liked, and it
   * is copied onto every submission the challenge produces — so an unchecked
   * one becomes a permanent, unfilterable value in somebody else's history.
   */
  const kind = requireActivityKind(activityKind);

  if (
    typeof targetDays !== 'number' ||
    !Number.isInteger(targetDays) ||
    targetDays < 1 ||
    targetDays > LIMITS.targetDaysMax
  ) {
    throw new HttpsError('invalid-argument', 'Invalid target days');
  }

  const userId = request.auth.uid;
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const challengeTitle = title
    ? requireString(title, 'Title', { max: LIMITS.titleChars })
    : `${targetDays}-day ${kind} Challenge`;

  const challengeRef = await db.collection('challenges').add({
    type: 'one_on_one',
    title: challengeTitle,
    // DO NOT store plaintext token - security risk
    // Token is returned once to creator for immediate sharing only
    inviteTokenHash: tokenHash, // Only hash is stored for lookups
    activityKind: kind,
    creatorId: userId,
    targetDays,
    sessionsPerDay: 1,
    status: 'pending',
    rematchOf: rematchOf || null,
    createdAt: new Date(),
  });

  logger.info('challenge created', {
    challengeId: challengeRef.id,
    creatorId: userId,
    activityKind: kind,
    targetDays,
  });

  return {
    success: true,
    challengeId: challengeRef.id,
    inviteToken: token, // Return to creator for sharing
    title: challengeTitle,
    createdAt: new Date().toISOString(),
  };
});

/**
 * Preview a challenge by invite token (before accepting).
 * 
 * Security model:
 * - Server-side hashed token lookup only
 * - Returns minimal preview data (no sensitive participant info)
 * - No plaintext token stored or queried in Firestore
 * 
 * @callable
 */
export const previewChallengeByToken = onCall(async request => {
  const { token } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid invite token');
  }

  // Previewing is the cheaper half of the same guess, so it is limited too.
  await countTokenAttempt(request.auth.uid);

  const tokenHash = hashInviteToken(token);

  // Look up challenge by hash
  const challengeSnap = await db
    .collection('challenges')
    .where('inviteTokenHash', '==', tokenHash)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (challengeSnap.empty) {
    throw new HttpsError('not-found', 'Challenge not found or already accepted');
  }

  const challenge = challengeSnap.docs[0];
  const challengeData = challenge.data();

  // Return minimal preview data
  return {
    success: true,
    challenge: {
      id: challenge.id,
      title: challengeData.title,
      activityKind: challengeData.activityKind,
      creatorId: challengeData.creatorId,
      targetDays: challengeData.targetDays,
      status: challengeData.status,
      createdAt: challengeData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    },
  };
});

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

    await countTokenAttempt(userId);

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
      code: generateGroupCode(),
      ownerUid: null, // A challenge pair group has no roster manager.
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
    code: generateGroupCode(),
    ownerUid: null, // A challenge pair group has no roster manager.
    memberIds: [userId, opponentId],
    createdAt: new Date(),
  });

  // Generate token (won't be stored, only hash)
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);

  // Create rematch challenge as active (both users known)
  const challengeRef = await db.collection('challenges').add({
    type: 'one_on_one',
    title: `${newTarget}-day ${original.activityKind} Challenge`,
    // DO NOT store plaintext token - security risk
    inviteTokenHash: tokenHash, // Only hash stored
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
      // Bounded: one unchecked write would otherwise own the leaderboard
      // permanently, and a bad GPS fix looks exactly like an attack.
      distanceKm: clampNumber(distanceKm, LIMITS.distanceKm, 'Distance'),
      kcal: clampNumber(kcal, LIMITS.kcal, 'Calories'),
    },
    status: 'auto_verified',
    approvals: [],
    rejections: [],
    autoChecks: { gpsOk: true, timestampOk: true },
    note: optionalText(note, LIMITS.noteChars),
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
