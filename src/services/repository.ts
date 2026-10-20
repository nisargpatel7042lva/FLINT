import type { RunnerProfile } from './runnerProfile';
import type { SessionLog } from './training';

/**
 * The data boundary.
 *
 * Screens depend on this interface, never on Firestore or on the fixtures.
 * That is what let Phase 5 be built against mock data and swapped to a real
 * backend here without touching a single screen's logic.
 */

export type UserProfile = {
  id: string;
  name: string;
  handle: string;
  joinedDay: string;
  /** Set once Cloud Messaging hands us a token. */
  fcmToken?: string;
  /**
   * The voice this person chose for the provocation layer.
   *
   * Mirrored here from the device preference because the pushes are written by
   * the server, which has to know whether to dare somebody or to jab them.
   * Lives on the PRIVATE document: how hard somebody asked to be pushed is
   * nobody else's business.
   */
  tone?: 'warm' | 'savage';
  /** Cached so Cloud Functions can decide who needs a nudge without a scan. */
  currentStreak?: number;
  lastSessionDay?: string;
  /**
   * The onboarding answers (see runnerProfile.ts). Private, like the tone:
   * mirrored so a new phone keeps the goal, and so the server can time
   * reminders to when this person actually runs.
   */
  runner?: RunnerProfile;
};

export type Unsubscribe = () => void;

export interface TrainingRepository {
  /** Which implementation is live — surfaced in the UI so it is never a mystery. */
  readonly kind: 'firestore' | 'local';

  listSessions(userId: string): Promise<SessionLog[]>;

  /** Live updates where the backend supports them; one-shot otherwise. */
  watchSessions(
    userId: string,
    onChange: (logs: SessionLog[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;

  addSession(userId: string, log: Omit<SessionLog, 'id'>): Promise<SessionLog>;

  getProfile(userId: string): Promise<UserProfile | null>;
  upsertProfile(userId: string, patch: Partial<UserProfile>): Promise<void>;
}
