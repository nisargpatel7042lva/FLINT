import type { SessionLog } from './training';
import { PROFILE, SESSION_LOGS } from './trainingData';
import type { TrainingRepository, Unsubscribe, UserProfile } from './repository';

/**
 * Local fallback used whenever Firebase is not configured.
 *
 * Deliberately in-memory: it holds writes for the lifetime of the process so
 * the app behaves correctly end to end (complete a session, watch the streak
 * move), but it does NOT pretend to persist. Anything written here is gone on
 * reload, and that is the honest behaviour for a repo with no backend.
 */
export class LocalTrainingRepository implements TrainingRepository {
  readonly kind = 'local' as const;

  private sessions: SessionLog[] = [...SESSION_LOGS];
  private profile: UserProfile = {
    id: 'local-user',
    name: PROFILE.name,
    handle: PROFILE.handle,
    joinedDay: PROFILE.joinedDay,
  };

  private listeners = new Set<(logs: SessionLog[]) => void>();

  private emit() {
    const snapshot = [...this.sessions];
    this.listeners.forEach(l => l(snapshot));
  }

  async listSessions(): Promise<SessionLog[]> {
    return [...this.sessions];
  }

  watchSessions(
    _userId: string,
    onChange: (logs: SessionLog[]) => void,
  ): Unsubscribe {
    this.listeners.add(onChange);
    onChange([...this.sessions]);
    return () => {
      this.listeners.delete(onChange);
    };
  }

  async addSession(
    _userId: string,
    log: Omit<SessionLog, 'id'>,
  ): Promise<SessionLog> {
    const created: SessionLog = { ...log, id: log.day };
    // Same "one per day" rule the Firestore implementation gets structurally.
    this.sessions = [created, ...this.sessions.filter(s => s.day !== log.day)].sort(
      (a, b) => b.day.localeCompare(a.day),
    );
    this.emit();
    return created;
  }

  async getProfile(): Promise<UserProfile | null> {
    return this.profile;
  }

  async upsertProfile(_userId: string, patch: Partial<UserProfile>): Promise<void> {
    this.profile = { ...this.profile, ...patch };
  }
}
