import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  type TrainingProfile,
} from '../services/profile';

/**
 * The training profile, shared across screens.
 *
 * A tiny module-level store rather than context: the profile is read by the
 * dashboard, the library, the logger and settings, and threading a provider
 * through for one small object nobody edits concurrently is more machinery
 * than the problem needs. Every subscriber sees every write.
 */
let cached: TrainingProfile = DEFAULT_PROFILE;
let hydrated = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(p: TrainingProfile) => void>();

const emit = () => listeners.forEach(l => l(cached));

function hydrate(): Promise<void> {
  if (hydrated) {
    return Promise.resolve();
  }
  if (!inFlight) {
    inFlight = loadProfile().then(p => {
      cached = p;
      hydrated = true;
      emit();
    });
  }
  return inFlight;
}

export type ProfileApi = {
  profile: TrainingProfile;
  /** False until the stored profile has been read. */
  loading: boolean;
  /** Merges a patch, persists, and notifies every subscriber. */
  update: (patch: Partial<TrainingProfile>) => void;
};

export function useProfile(): ProfileApi {
  const [profile, setProfile] = useState<TrainingProfile>(cached);
  const [loading, setLoading] = useState(!hydrated);

  useEffect(() => {
    let alive = true;
    const listener = (p: TrainingProfile) => {
      if (alive) {
        setProfile(p);
      }
    };
    listeners.add(listener);

    hydrate().then(() => {
      if (alive) {
        setProfile(cached);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback((patch: Partial<TrainingProfile>) => {
    cached = { ...cached, ...patch };
    emit();
    // Fire and forget: a failed write costs this answer, never the tap.
    saveProfile(cached);
  }, []);

  return { profile, loading, update };
}

/** Test seam. Not used by the app. */
export function __resetProfileCache() {
  cached = DEFAULT_PROFILE;
  hydrated = false;
  inFlight = null;
  listeners.clear();
}
