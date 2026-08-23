import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/**
 * GPS tracking for outdoor sessions.
 *
 * Uses Fused Location on Android via @react-native-community/geolocation. Only
 * foreground location is requested — sessions are tracked while the app is
 * open, so background location would be asking for a permission we do not use.
 */

export type GeoPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
};

export type TrackSummary = {
  points: GeoPoint[];
  distanceKm: number;
  durationSeconds: number;
};

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  // Fused Location on Android: better accuracy for the same battery.
  locationProvider: 'auto',
});

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return new Promise(resolve =>
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      ),
    );
  }

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  // Android 12+ can grant COARSE only. That is still usable for distance, so
  // treat either grant as success rather than forcing an all-or-nothing prompt.
  return (
    granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' ||
    granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted'
  );
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Discards jitter: GPS noise while standing still otherwise inflates distance. */
const MIN_ACCURACY_M = 50;
const MIN_STEP_KM = 0.005;

export function summarise(points: GeoPoint[]): TrackSummary {
  let distanceKm = 0;
  for (let i = 1; i < points.length; i += 1) {
    const step = haversineKm(points[i - 1], points[i]);
    if (step >= MIN_STEP_KM) {
      distanceKm += step;
    }
  }
  const durationSeconds =
    points.length > 1
      ? Math.round((points[points.length - 1].timestamp - points[0].timestamp) / 1000)
      : 0;

  return { points, distanceKm: Math.round(distanceKm * 100) / 100, durationSeconds };
}

export type LocationTracker = {
  stop: () => TrackSummary;
};

/**
 * Starts a foreground track. Call `stop()` to end it and get the summary.
 * Returns null if permission was refused.
 */
export async function startTracking(
  onUpdate?: (summary: TrackSummary) => void,
): Promise<LocationTracker | null> {
  const ok = await requestLocationPermission();
  if (!ok) {
    return null;
  }

  const points: GeoPoint[] = [];

  const watchId = Geolocation.watchPosition(
    pos => {
      const accuracy = pos.coords.accuracy ?? null;
      if (accuracy !== null && accuracy > MIN_ACCURACY_M) {
        return; // too imprecise to be worth recording
      }
      points.push({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        timestamp: pos.timestamp,
        accuracy,
      });
      onUpdate?.(summarise(points));
    },
    () => {
      /* transient fixes fail often; keep watching */
    },
    { enableHighAccuracy: true, distanceFilter: 5, interval: 3000, fastestInterval: 1000 },
  );

  return {
    stop: () => {
      Geolocation.clearWatch(watchId);
      return summarise(points);
    },
  };
}
