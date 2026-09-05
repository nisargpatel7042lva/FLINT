/**
 * 1:1 Challenge service for the Flint MVP.
 * 
 * Handles challenge creation, invites, acceptance, activity logging, and streaks.
 */

import type {
  ActivityKind,
  OneOnOneChallenge,
  ChallengeStreak,
  Submission,
  Group,
} from './types';

/** Generate a unique invite token for a challenge */
export function generateInviteToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/** Get local date string YYYY-MM-DD from device timezone */
export function getLocalDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add days to a date */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDay(d);
}

/** Check if a date is today in local timezone */
export function isToday(dateStr: string): boolean {
  return dateStr === getLocalDay();
}

/** Check if a date is before another */
export function isBefore(date1: string, date2: string): boolean {
  return date1 < date2;
}

/** Check if a date is after another */
export function isAfter(date1: string, date2: string): boolean {
  return date1 > date2;
}

/** Days between two dates */
export function daysBetween(start: string, end: string): number {
  const d1 = new Date(`${start}T00:00:00`);
  const d2 = new Date(`${end}T00:00:00`);
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
}

/**
 * Compute challenge streak from submissions.
 * 
 * Consecutive days ending today or yesterday (grace). Miss = break.
 */
export function computeChallengeStreak(
  submissions: Submission[],
  challengeId: string,
  userId: string,
  today: string = getLocalDay(),
): ChallengeStreak {
  const userSubs = submissions
    .filter(s => s.groupId === challengeId && s.memberId === userId && s.status !== 'rejected')
    .sort((a, b) => a.day.localeCompare(b.day));

  const days = new Set(userSubs.map(s => s.day));
  const totalActiveDays = days.size;

  if (days.size === 0) {
    return {
      challengeId,
      userId,
      currentStreak: 0,
      bestStreak: 0,
      totalActiveDays: 0,
    };
  }

  // Compute current streak (consecutive days ending today or yesterday)
  const todayDate = new Date(`${today}T00:00:00`);
  const yesterday = getLocalDay(new Date(todayDate.getTime() - 86400000));
  
  let currentStreak = 0;
  let cursor = days.has(today) ? today : yesterday;
  
  if (days.has(cursor)) {
    while (days.has(cursor)) {
      currentStreak++;
      const cursorDate = new Date(`${cursor}T00:00:00`);
      cursor = getLocalDay(new Date(cursorDate.getTime() - 86400000));
    }
  }

  // Compute best streak
  const sortedDays = Array.from(days).sort();
  let bestStreak = 0;
  let tempStreak = 1;
  
  for (let i = 1; i < sortedDays.length; i++) {
    const prevDate = new Date(`${sortedDays[i - 1]}T00:00:00`);
    const expectedNext = getLocalDay(new Date(prevDate.getTime() + 86400000));
    
    if (sortedDays[i] === expectedNext) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  const lastActivityDay = sortedDays[sortedDays.length - 1];

  return {
    challengeId,
    userId,
    currentStreak,
    bestStreak,
    lastActivityDay,
    totalActiveDays,
  };
}

/**
 * Check if a challenge is complete.
 */
export function isChallengeComplete(
  challenge: OneOnOneChallenge,
  creatorStreak: ChallengeStreak,
  opponentStreak?: ChallengeStreak,
): boolean {
  if (!challenge.startDay || !challenge.endDay) {
    return false;
  }
  
  const today = getLocalDay();
  const challengeEnded = isAfter(today, challenge.endDay);
  
  // Challenge is complete if:
  // 1. End day has passed, OR
  // 2. Either user reached the target days
  return (
    challengeEnded ||
    creatorStreak.totalActiveDays >= challenge.targetDays ||
    (opponentStreak?.totalActiveDays ?? 0) >= challenge.targetDays
  );
}

/**
 * Build a rematch challenge with increased difficulty.
 */
export function buildRematch(
  original: OneOnOneChallenge,
  creatorId: string,
  opponentId: string,
): Omit<OneOnOneChallenge, 'id' | 'createdAt'> {
  // Bump target days by 25% or +7, whichever is larger
  const increase = Math.max(Math.ceil(original.targetDays * 0.25), 7);
  const newTargetDays = original.targetDays + increase;

  return {
    type: 'one_on_one',
    title: `${newTargetDays}-day ${original.title.split('-day')[1] || 'Challenge'}`,
    inviteToken: generateInviteToken(),
    activityKind: original.activityKind,
    creatorId,
    opponentId,
    targetDays: newTargetDays,
    sessionsPerDay: original.sessionsPerDay,
    status: 'active',
    acceptedAt: new Date().toISOString(),
    startDay: getLocalDay(),
    endDay: addDays(getLocalDay(), newTargetDays),
  };
}

/**
 * Get today's submissions for a challenge group.
 */
export function getTodaySubmissions(
  submissions: Submission[],
  groupId: string,
  today: string = getLocalDay(),
): Submission[] {
  return submissions.filter(s => s.groupId === groupId && s.day === today);
}

/**
 * Check if user has logged today for a challenge.
 */
export function hasLoggedToday(
  submissions: Submission[],
  challengeId: string,
  userId: string,
  today: string = getLocalDay(),
): boolean {
  return submissions.some(
    s =>
      s.groupId === challengeId &&
      s.memberId === userId &&
      s.day === today &&
      s.status !== 'rejected',
  );
}
