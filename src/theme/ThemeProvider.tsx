import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import type { AccentName } from './colors';
import type { Tone } from '../services/ego';
import { createTheme, type Theme, type ThemeMode } from './theme';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
  type ThemePreference,
} from '../services/preferences';

type ThemeContextValue = {
  theme: Theme;
  /** The mode actually being rendered, after resolving 'system'. */
  mode: ThemeMode;
  /** What the user chose, which may be 'system'. */
  preference: ThemePreference;
  accentName: AccentName;
  /** True until stored preferences have been read. */
  loading: boolean;

  setPreference: (p: ThemePreference) => void;
  setAccent: (accent: AccentName) => void;
  toggleMode: () => void;

  /** Persisted flags that live alongside the theme. */
  tourDone: boolean;
  setTourDone: (done: boolean) => void;
  /** The voice the provocation layer speaks in. */
  tone: Tone;
  setTone: (tone: Tone) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ThemeProviderProps = PropsWithChildren<{
  /** Forces a mode and disables persistence. Used by ThemeScope. */
  fixedMode?: ThemeMode;
  fixedAccent?: AccentName;
}>;

/**
 * Root theme provider.
 *
 * Owns three things: the resolved theme, the user's stored preference, and the
 * 'system' option that follows the OS. 'system' is the default because a phone
 * already knows whether its owner wants dark right now, and an app that ignores
 * that is the one people complain about at 1am.
 */
export function ThemeProvider({
  children,
  fixedMode,
  fixedAccent,
}: ThemeProviderProps) {
  const osScheme = useColorScheme();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(!fixedMode);

  // A nested/fixed provider is a pure override — it must not read or write the
  // stored preference, or a per-screen scope would overwrite the user's choice.
  useEffect(() => {
    if (fixedMode) {
      return;
    }
    let cancelled = false;
    loadPreferences().then(loaded => {
      if (!cancelled) {
        setPrefs(loaded);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fixedMode]);

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      setPrefs(current => {
        const next = { ...current, ...patch };
        if (!fixedMode) {
          // Fire-and-forget: a preference write must never block the UI, and a
          // failed write is a bad session rather than a bad app.
          savePreferences(next).catch(() => {});
        }
        return next;
      });
    },
    [fixedMode],
  );

  const preference: ThemePreference = fixedMode ?? prefs.themeMode;
  const accentName = fixedAccent ?? prefs.accent;

  // 'system' resolves here, and re-resolves on its own when the OS flips.
  const mode: ThemeMode =
    preference === 'system' ? (osScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: createTheme(mode, accentName),
      mode,
      preference,
      accentName,
      loading,
      setPreference: p => update({ themeMode: p }),
      setAccent: a => update({ accent: a }),
      toggleMode: () => update({ themeMode: mode === 'light' ? 'dark' : 'light' }),
      tourDone: prefs.tourDone,
      setTourDone: done => update({ tourDone: done }),
      tone: prefs.tone,
      setTone: tone => update({ tone }),
    }),
    [mode, accentName, preference, loading, prefs.tourDone, prefs.tone, update],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the full theme context, including the setters. */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used inside a <ThemeProvider>.');
  }
  return ctx;
}

/** The common case — just the resolved theme tokens. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/**
 * Overrides the colour mode for one subtree.
 *
 * The reference design mixes cream screens with near-black ones inside a single
 * app, so some screens pin a mode regardless of the global setting — the tab
 * bar, rendered by the navigator outside the screen, keeps the root mode and
 * floats over the page as the reference does.
 *
 * The accent is inherited from the parent rather than re-specified: hard-coding
 * orange here would strand these screens if the user picks lime or emerald.
 *
 * Named ThemeScope, not ThemeMode, because `ThemeMode` is already the
 * 'light' | 'dark' union exported from theme.ts and a component sharing the
 * name resolves to the type at the call site.
 */
export function ThemeScope({
  mode,
  children,
}: PropsWithChildren<{ mode: ThemeMode }>) {
  const parent = useContext(ThemeContext);
  return (
    <ThemeProvider fixedMode={mode} fixedAccent={parent?.accentName ?? 'orange'}>
      {children}
    </ThemeProvider>
  );
}
