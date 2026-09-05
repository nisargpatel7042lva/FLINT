/**
 * Firestore repository for 1:1 challenges.
 * 
 * Handles CRUD operations for challenges, submissions, and streaks.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  addDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

import { requireFirebase } from './backend';
import type {
  OneOnOneChallenge,
  ChallengeStreak,
  Submission,
  Group,
  ActivityKind,
  Effort,
} from './types';
import { generateInviteToken, getLocalDay, addDays } from './challenges';
import type { Unsubscribe } from './repository';

const db = () => getFirestore(requireFirebase());
const functions = () => getFunctions(requireFirebase());
const challengesCol = () => collection(db(), 'challenges');
const submissionsCol = () => collection(db(), 'submissions');
const streaksCol = () => collection(db(), 'challengeStreaks');
const groupsCol = () => collection(db(), 'groups');

/**
 * Hash an invite token for secure storage.
 * Must match server-side hashing in Cloud Functions.
 */
async function hashInviteToken(token: string): Promise<string> {
  // Use Web Crypto API for SHA-256
  const pepper = 'flint-mvp-join-pepper-change-in-production'; // Must match server
  const encoder = new TextEncoder();
  const data = encoder.encode(pepper + token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new 1:1 challenge.
 */
export async function createOneOnOneChallenge(
  creatorId: string,
  activityKind: ActivityKind,
  targetDays: number,
  title?: string,
  rematchOf?: string,
): Promise<OneOnOneChallenge> {
  const inviteToken = generateInviteToken();
  const inviteTokenHash = await hashInviteToken(inviteToken);
  const now = new Date().toISOString();

  const challengeData: Omit<OneOnOneChallenge, 'id'> = {
    type: 'one_on_one',
    title: title || `${targetDays}-day ${activityKind} Challenge`,
    inviteToken,
    activityKind,
    creatorId,
    targetDays,
    sessionsPerDay: 1,
    status: 'pending',
    createdAt: now,
  };

  const docRef = await addDoc(challengesCol(), {
    ...challengeData,
    inviteTokenHash, // Store hash for secure lookup
    rematchOf: rematchOf || null, // Track rematch lineage
    createdAt: serverTimestamp(),
  });

  return { ...challengeData, id: docRef.id };
}

/**
 * Get a challenge by ID.
 */
export async function getChallenge(challengeId: string): Promise<OneOnOneChallenge | null> {
  const snap = await getDoc(doc(challengesCol(), challengeId));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    type: 'one_on_one',
    title: String(data.title || ''),
    inviteToken: String(data.inviteToken || ''),
    activityKind: (data.activityKind as ActivityKind) || 'run',
    creatorId: String(data.creatorId || ''),
    opponentId: data.opponentId ? String(data.opponentId) : undefined,
    groupId: data.groupId ? String(data.groupId) : undefined,
    targetDays: Number(data.targetDays || 30),
    sessionsPerDay: Number(data.sessionsPerDay || 1),
    status: (data.status as 'pending' | 'active' | 'completed') || 'pending',
    createdAt: String(data.createdAt || new Date().toISOString()),
    acceptedAt: data.acceptedAt ? String(data.acceptedAt) : undefined,
    completedAt: data.completedAt ? String(data.completedAt) : undefined,
    startDay: data.startDay ? String(data.startDay) : undefined,
    endDay: data.endDay ? String(data.endDay) : undefined,
  };
}

/**
 * Get a challenge by invite token.
 */
export async function getChallengeByToken(token: string): Promise<OneOnOneChallenge | null> {
  const q = query(challengesCol(), where('inviteToken', '==', token));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    return null;
  }
  
  const data = snap.docs[0].data() as Record<string, unknown>;
  return {
    id: snap.docs[0].id,
    type: 'one_on_one',
    title: String(data.title || ''),
    inviteToken: String(data.inviteToken || ''),
    activityKind: (data.activityKind as ActivityKind) || 'run',
    creatorId: String(data.creatorId || ''),
    opponentId: data.opponentId ? String(data.opponentId) : undefined,
    groupId: data.groupId ? String(data.groupId) : undefined,
    targetDays: Number(data.targetDays || 30),
    sessionsPerDay: Number(data.sessionsPerDay || 1),
    status: (data.status as 'pending' | 'active' | 'completed') || 'pending',
    createdAt: String(data.createdAt || new Date().toISOString()),
    acceptedAt: data.acceptedAt ? String(data.acceptedAt) : undefined,
    completedAt: data.completedAt ? String(data.completedAt) : undefined,
    startDay: data.startDay ? String(data.startDay) : undefined,
    endDay: data.endDay ? String(data.endDay) : undefined,
  };
}

/**
 * Accept a challenge invite using the secure callable function.
 */
export async function acceptChallenge(
  token: string,
): Promise<{ challengeId: string; groupId: string }> {
  const redeemJoinCode = httpsCallable(functions(), 'redeemJoinCode');
  
  try {
    const result = await redeemJoinCode({ token });
    const data = result.data as { success: boolean; challengeId: string; groupId: string };
    
    if (!data.success) {
      throw new Error('Failed to redeem challenge code');
    }

    return {
      challengeId: data.challengeId,
      groupId: data.groupId,
    };
  } catch (error: any) {
    // Map Firebase errors to user-friendly messages
    if (error.code === 'functions/not-found') {
      throw new Error('Challenge not found or already accepted');
    } else if (error.code === 'functions/already-exists') {
      throw new Error('Challenge already has an opponent');
    } else if (error.code === 'functions/resource-exhausted') {
      throw new Error('Too many attempts. Please try again later.');
    } else if (error.code === 'functions/unauthenticated') {
      throw new Error('You must be signed in to accept challenges');
    }
    throw error;
  }
}

/**
 * Log activity for a challenge using the secure callable function.
 */
export async function logChallengeActivity(
  challengeId: string,
  userId: string,
  activityKind: ActivityKind,
  effort: Effort,
  note?: string,
): Promise<Submission> {
  const logActivity = httpsCallable(functions(), 'logChallengeActivity');

  try {
    const result = await logActivity({
      challengeId,
      distanceKm: effort.distanceKm,
      kcal: effort.kcal,
      note,
    });

    const data = result.data as { success: boolean; submissionId: string; day: string };

    if (!data.success) {
      throw new Error('Failed to log activity');
    }

    // Return the submission data
    return {
      id: data.submissionId,
      memberId: userId,
      groupId: '', // Will be filled by server
      day: data.day,
      kind: activityKind,
      effort,
      status: 'auto_verified',
      approvals: [],
      rejections: [],
      autoChecks: { gpsOk: true, timestampOk: true },
      note,
      createdAt: new Date().toISOString(),
      reactions: { fire: 0, strong: 0, clap: 0, eyes: 0 },
    };
  } catch (error: any) {
    // Map Firebase errors to user-friendly messages
    if (error.code === 'functions/not-found') {
      throw new Error('Challenge not found');
    } else if (error.code === 'functions/already-exists') {
      throw new Error('Already logged for today');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('You are not a participant in this challenge');
    } else if (error.code === 'functions/failed-precondition') {
      throw new Error('Challenge is not active');
    }
    throw error;
  }
}

/**
 * Create a rematch challenge using the secure callable function.
 */
export async function rematchChallenge(
  originalChallengeId: string,
): Promise<{ challengeId: string; groupId: string }> {
  const createRematch = httpsCallable(functions(), 'createRematch');

  try {
    const result = await createRematch({ originalChallengeId });
    const data = result.data as { success: boolean; challengeId: string; groupId: string };

    if (!data.success) {
      throw new Error('Failed to create rematch');
    }

    return {
      challengeId: data.challengeId,
      groupId: data.groupId,
    };
  } catch (error: any) {
    // Map Firebase errors to user-friendly messages
    if (error.code === 'functions/not-found') {
      throw new Error('Original challenge not found');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('You are not a participant in the original challenge');
    } else if (error.code === 'functions/failed-precondition') {
      throw new Error('Cannot create rematch for this challenge');
    }
    throw error;
  }
}

/**
 * Get submissions for a challenge.
 */
export async function getChallengeSubmissions(
  challengeId: string,
): Promise<Submission[]> {
  const challenge = await getChallenge(challengeId);
  if (!challenge || !challenge.groupId) {
    return [];
  }

  const q = query(
    submissionsCol(),
    where('groupId', '==', challenge.groupId),
    orderBy('day', 'desc'),
  );

  const snap = await getDocs(q);
  return snap.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      memberId: String(data.memberId || ''),
      groupId: String(data.groupId || ''),
      day: String(data.day || ''),
      kind: (data.kind as ActivityKind) || 'run',
      effort: (data.effort as Effort) || { workouts: 0, distanceKm: 0, kcal: 0 },
      status: (data.status as 'auto_verified') || 'auto_verified',
      approvals: (data.approvals as string[]) || [],
      rejections: (data.rejections as string[]) || [],
      autoChecks: (data.autoChecks as { gpsOk: boolean; timestampOk: boolean }) || {
        gpsOk: true,
        timestampOk: true,
      },
      note: data.note ? String(data.note) : undefined,
      createdAt: String(data.createdAt || ''),
      reactions: (data.reactions as Record<string, number>) || {
        fire: 0,
        strong: 0,
        clap: 0,
        eyes: 0,
      },
    };
  });
}

/**
 * Get challenge streak for a user.
 */
export async function getChallengeStreak(
  challengeId: string,
  userId: string,
): Promise<ChallengeStreak | null> {
  const streakId = `${challengeId}_${userId}`;
  const snap = await getDoc(doc(streaksCol(), streakId));

  if (!snap.exists()) {
    return {
      challengeId,
      userId,
      currentStreak: 0,
      bestStreak: 0,
      totalActiveDays: 0,
    };
  }

  const data = snap.data() as Record<string, unknown>;
  return {
    challengeId: String(data.challengeId || challengeId),
    userId: String(data.userId || userId),
    currentStreak: Number(data.currentStreak || 0),
    bestStreak: Number(data.bestStreak || 0),
    lastActivityDay: data.lastActivityDay ? String(data.lastActivityDay) : undefined,
    totalActiveDays: Number(data.totalActiveDays || 0),
  };
}

/**
 * Watch challenges for a user (creator or opponent).
 */
export function watchUserChallenges(
  userId: string,
  onChange: (challenges: OneOnOneChallenge[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q1 = query(challengesCol(), where('creatorId', '==', userId));
  const q2 = query(challengesCol(), where('opponentId', '==', userId));

  // Note: This is a simplified version. In production, you'd want to combine these queries
  // or use a different strategy.
  return onSnapshot(
    q1,
    snap => {
      const challenges = snap.docs.map(doc => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          type: 'one_on_one' as const,
          title: String(data.title || ''),
          inviteToken: String(data.inviteToken || ''),
          activityKind: (data.activityKind as ActivityKind) || 'run',
          creatorId: String(data.creatorId || ''),
          opponentId: data.opponentId ? String(data.opponentId) : undefined,
          groupId: data.groupId ? String(data.groupId) : undefined,
          targetDays: Number(data.targetDays || 30),
          sessionsPerDay: Number(data.sessionsPerDay || 1),
          status: (data.status as 'pending' | 'active' | 'completed') || 'pending',
          createdAt: String(data.createdAt || ''),
          acceptedAt: data.acceptedAt ? String(data.acceptedAt) : undefined,
          completedAt: data.completedAt ? String(data.completedAt) : undefined,
          startDay: data.startDay ? String(data.startDay) : undefined,
          endDay: data.endDay ? String(data.endDay) : undefined,
        };
      });
      onChange(challenges);
    },
    err => onError?.(err as Error),
  );
}
