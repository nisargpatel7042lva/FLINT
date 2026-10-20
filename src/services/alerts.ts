import { NativeModules, Platform } from 'react-native';

/**
 * Club alerts while the app is closed — checked on the phone, not pushed.
 *
 * Push from a server needs Firebase's paid plan, so the native side
 * (`com.kasrat.alerts.AlertCheckWorker`) looks for new nudges, overtakes and
 * stolen blocks every 15 minutes or so, as the signed-in user, and posts the
 * notification itself. These are the switches; all of them are best effort.
 */
type NativeAlerts = {
  start(): Promise<boolean>;
  setRegions(regions: string[]): Promise<boolean>;
  stop(): Promise<boolean>;
};

const native: NativeAlerts | undefined =
  Platform.OS === 'android' ? NativeModules.FlintAlerts : undefined;

/** Schedules the check for whoever is signed in. Safe to call on every launch. */
export function startBackgroundAlerts(): Promise<boolean> {
  return native ? native.start().catch(() => false) : Promise.resolve(false);
}

/** The city regions to watch for stolen blocks: around where the map is centred. */
export function watchRegions(regions: string[]): void {
  native?.setRegions(regions).catch(() => {});
}

export function stopBackgroundAlerts(): Promise<boolean> {
  return native ? native.stop().catch(() => false) : Promise.resolve(false);
}
