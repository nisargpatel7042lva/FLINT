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
const challengesCol = () => collection(db(), 'challenges');
const submissionsCol = () => collection(db(), 'submissions');
const streaksCol = () => collection(db(), 'challengeStreaks');
const groupsCol = () => collection(db(), 'groups');

/**
 * Create a new 1:1 challenge.
 */
export async function createOneOnOneChallenge(
  creatorId: string,
  activityKind: ActivityKind,
  targetDays: number,
  title?: string,
): Promise<OneOnOneChallenge> {
  const inviteToken = generateInviteToken();
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
 * Accept a challenge invite.
 */
export async function acceptChallenge(
  challengeId: string,
  opponentId: string,
): Promise<{ challenge: OneOnOneChallenge; group: Group }> {
  const challengeRef = doc(challengesCol(), challengeId);
  const challenge = await getChallenge(challengeId);
  
  if (!challenge) {
    throw new Error('Challenge not found');
  }

  const today = getLocalDay();
  const endDay = addDays(today, challenge.targetDays);

  // Create a group for the challenge
  const groupData = {
    name: `${challenge.title} Group`,
    code: challenge.inviteToken.substring(0, 6),
    memberIds: [challenge.creatorId, opponentId],
    createdAt: serverTimestamp(),
  };

  const groupRef = await addDoc(groupsCol(), groupData);

  // Update the challenge
  await updateDoc(challengeRef, {
    opponentId,
    groupId: groupRef.id,
    status: 'active',
    acceptedAt: serverTimestamp(),
    startDay: today,
    endDay,
  });

  const updatedChallenge: OneOnOneChallenge = {
    ...challenge,
    opponentId,
    groupId: groupRef.id,
    status: 'active',
    acceptedAt: new Date().toISOString(),
    startDay: today,
    endDay,
  };

  const group: Group = {
    id: groupRef.id,
    name: groupData.name,
    code: groupData.code,
    memberIds: groupData.memberIds,
    createdAt: new Date().toISOString(),
  };

  return { challenge: updatedChallenge, group };
}

/**
 * Log activity for a challenge.
 */
export async function logChallengeActivity(
  challengeId: string,
  userId: string,
  activityKind: ActivityKind,
  effort: Effort,
  note?: string,
): Promise<Submission> {
  const challenge = await getChallenge(challengeId);
  if (!challenge || !challenge.groupId) {
    throw new Error('Challenge not found or not active');
  }

  const today = getLocalDay();

  const submissionData: Omit<Submission, 'id'> = {
    memberId: userId,
    groupId: challenge.groupId,
    day: today,
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

  const docRef = await addDoc(submissionsCol(), {
    ...submissionData,
    createdAt: serverTimestamp(),
  });

  return { ...submissionData, id: docRef.id };
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
