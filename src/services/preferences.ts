import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AccentName } from '../theme/colors';

/**
 * Device-local preferences.
 *
 * These belong on the device, not in Firestore: a theme choice is about the
 * phone you are holding (its screen, its ambient light, its own dark-mode
 * setting), not about the account. Syncing it would mean your desk setup
 * decides how the app looks on a run at night.
 *
 * Every read is failure-tolerant. Storage can be unavailable, and a preference
 * is never important enough to block the app — it falls back to defaults.
 */

/** 'system' follows the OS setting, which is what most people expect. */
export type ThemePreference = 'system' | 'light' | 'dark';

export type Preferences = {
  themeMode: ThemePreference;
  accent: AccentName;
  /** Whether the first-run walkthrough has been completed or skipped. */
  tourDone: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  accent: 'orange',
  tourDone: false,
};

const KEY = 'kasrat.preferences.v1';

export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>;

    // Stored values are untrusted input — an old build or a hand-edited value
    // must not put the theme into a state the app cannot render.
    return {
      themeMode:
        parsed.themeMode === 'light' ||
        parsed.themeMode === 'dark' ||
        parsed.themeMode === 'system'
          ? parsed.themeMode
          : DEFAULT_PREFERENCES.themeMode,
      accent:
        parsed.accent === 'orange' ||
        parsed.accent === 'lime' ||
        parsed.accent === 'emerald'
          ? parsed.accent
          : DEFAULT_PREFERENCES.accent,
      tourDone: parsed.tourDone === true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // A preference that fails to persist is a bad session, not a bad app.
  }
}

/** Used by the "replay the walkthrough" action in settings. */
export async function resetTour(): Promise<void> {
  const prefs = await loadPreferences();
  await savePreferences({ ...prefs, tourDone: false });
}
