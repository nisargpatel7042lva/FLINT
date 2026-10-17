import { useCallback, useEffect, useMemo, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';

import {
  EMBER_WINDOW_DAYS,
  computeCity,
  regionFor,
  snapshotOf,
  standings,
  stealsSince,
  type CityRun,
  type CityState,
  type OwnershipSnapshot,
  type Standing,
  type Steal,
} from '../services/city';
import { getSocialRepository } from '../services/socialRepositoryProvider';

export type LatLon = { latitude: number; longitude: number };

/**
 * Where the map opens before we know where you are: central Vadodara, where
 * the first clubs are. Replaced by a real fix as soon as there is one.
 */
export const DEFAULT_CENTRE: LatLon = { latitude: 22.3072, longitude: 73.1812 };

const CENTRE_KEY = 'flint.city.centre.v1';
const SEEN_KEY = 'flint.city.seen.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/** The region around a point, and its eight neighbours. */
export function regionsAround(c: LatLon): string[] {
  const [r, col] = regionFor(c.latitude, c.longitude).split(':').map(Number);
  const out: string[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      out.push(`${r + dr}:${col + dc}`);
    }
  }
  return out;
}

async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
}

/**
 * A rough fix, without asking for permission.
 *
 * The map is not worth a permission prompt on its own — the run screen asks
 * when it actually needs to. If permission was given there, use it; otherwise
 * the map opens where the last run was, or on the default city.
 */
function roughFix(): Promise<LatLon | null> {
  return new Promise(resolve =>
    Geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 8000 },
    ),
  );
}

export type CityApi = {
  centre: LatLon;
  state: CityState;
  standings: Standing[];
  /** Blocks taken from my clubs since I last looked. */
  steals: Steal[];
  /** Records the map as seen, so the same steal is not reported twice. */
  acknowledge: () => void;
  loading: boolean;
};

/**
 * The city map's data: who owns which block, and what changed since last time.
 */
export function useCity(myClubIds: string[]): CityApi {
  const repo = useMemo(() => getSocialRepository(), []);
  const [centre, setCentre] = useState<LatLon>(DEFAULT_CENTRE);
  const [runs, setRuns] = useState<CityRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState<OwnershipSnapshot | null>(null);
  // A clock that moves, so blocks burn out while the screen is open.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(CENTRE_KEY)
      .then(raw => {
        if (alive && raw) {
          const c = JSON.parse(raw) as LatLon;
          if (Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
            setCentre(c);
          }
        }
      })
      .catch(() => {});
    hasLocationPermission()
      .then(ok => (ok ? roughFix() : null))
      .then(fix => {
        if (alive && fix) {
          setCentre(fix);
          AsyncStorage.setItem(CENTRE_KEY, JSON.stringify(fix)).catch(() => {});
        }
      })
      .catch(() => {});
    AsyncStorage.getItem(SEEN_KEY)
      .then(raw => alive && setSeen(raw ? (JSON.parse(raw) as OwnershipSnapshot) : {}))
      .catch(() => alive && setSeen({}));
    return () => {
      alive = false;
    };
  }, []);

  // Re-subscribe only when the centre moves to a different region.
  const regionKey = regionFor(centre.latitude, centre.longitude);
  useEffect(() => {
    const since = Date.now() - EMBER_WINDOW_DAYS * DAY_MS;
    const unsub = repo.watchCity(regionsAround(centre), since, next => {
      setRuns(next);
      setLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, regionKey]);

  const state = useMemo(() => computeCity(runs, now), [runs, now]);
  const clubKey = myClubIds.join(',');
  const steals = useMemo(
    () => (seen && !loading ? stealsSince(seen, state, myClubIds) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seen, state, loading, clubKey],
  );

  const acknowledge = useCallback(() => {
    if (loading) {
      return;
    }
    const snap = snapshotOf(state);
    setSeen(snap);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(snap)).catch(() => {});
  }, [state, loading]);

  return {
    centre,
    state,
    standings: useMemo(() => standings(state), [state]),
    steals,
    acknowledge,
    loading,
  };
}
