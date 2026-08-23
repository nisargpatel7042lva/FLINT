import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';

import { requireFirebase } from './backend';
import type { SessionLog } from './training';
import type { TrainingRepository, Unsubscribe, UserProfile } from './repository';

/**
 * Firestore-backed repository.
 *
 * Layout — sessions are a subcollection of the user rather than a top-level
 * collection, so security rules are a single `request.auth.uid == userId`
 * check and a user can never read another user's training data:
 *
 *   users/{userId}                     -> UserProfile
 *   users/{userId}/sessions/{dayKey}   -> SessionLog
 *
 * A session's document id is its calendar day. That makes "one session per day"
 * a structural guarantee rather than something the client has to enforce, which
 * matters because streaks are computed from distinct days.
 */

const SESSION_LIMIT = 365;

const usersCol = () => collection(getFirestore(requireFirebase()), 'users');
const sessionsCol = (userId: string) => collection(doc(usersCol(), userId), 'sessions');

/** Firestore documents are untrusted input — coerce rather than cast. */
function toSessionLog(id: string, data: Record<string, unknown>): SessionLog {
  return {
    id,
    day: String(data.day ?? id),
    title: String(data.title ?? 'Session'),
    focus: (data.focus as SessionLog['focus']) ?? 'full',
    minutes: Number(data.minutes ?? 0),
    completedSets: Number(data.completedSets ?? 0),
    totalSets: Number(data.totalSets ?? 0),
    kcal: Number(data.kcal ?? 0),
  };
}

export class FirestoreTrainingRepository implements TrainingRepository {
  readonly kind = 'firestore' as const;

  async listSessions(userId: string): Promise<SessionLog[]> {
    const snap = await getDocs(
      query(sessionsCol(userId), orderBy('day', 'desc'), limit(SESSION_LIMIT)),
    );
    return snap.docs.map(d => toSessionLog(d.id, d.data() as Record<string, unknown>));
  }

  watchSessions(
    userId: string,
    onChange: (logs: SessionLog[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(sessionsCol(userId), orderBy('day', 'desc'), limit(SESSION_LIMIT)),
      snap => {
        onChange(
          snap.docs.map(d => toSessionLog(d.id, d.data() as Record<string, unknown>)),
        );
      },
      err => onError?.(err as Error),
    );
  }

  async addSession(
    userId: string,
    log: Omit<SessionLog, 'id'>,
  ): Promise<SessionLog> {
    // Keyed by day so a second session on the same day updates rather than
    // duplicating — distinct days are what streaks are built from.
    const ref = doc(sessionsCol(userId), log.day);
    await setDoc(ref, { ...log, updatedAt: serverTimestamp() }, { merge: true });

    // Mirror onto the profile so streak nudges do not need to scan sessions.
    await this.upsertProfile(userId, { lastSessionDay: log.day });

    return { ...log, id: log.day };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(usersCol(), userId));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as Record<string, unknown>;
    return {
      id: userId,
      name: String(data.name ?? ''),
      handle: String(data.handle ?? ''),
      joinedDay: String(data.joinedDay ?? ''),
      fcmToken: data.fcmToken ? String(data.fcmToken) : undefined,
      currentStreak: data.currentStreak != null ? Number(data.currentStreak) : undefined,
      lastSessionDay: data.lastSessionDay ? String(data.lastSessionDay) : undefined,
    };
  }

  async upsertProfile(userId: string, patch: Partial<UserProfile>): Promise<void> {
    await setDoc(
      doc(usersCol(), userId),
      { ...patch, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}
