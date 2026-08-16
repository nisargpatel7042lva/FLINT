import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { AccentName } from './colors';
import { createTheme, type Theme, type ThemeMode } from './theme';

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  accentName: AccentName;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  /** Swap the accent at runtime — useful when trying alternate layouts. */
  setAccent: (accent: AccentName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ThemeProviderProps = PropsWithChildren<{
  initialMode?: ThemeMode;
  initialAccent?: AccentName;
}>;

export function ThemeProvider({
  children,
  initialMode = 'light',
  initialAccent = 'orange',
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [accentName, setAccent] = useState<AccentName>(initialAccent);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: createTheme(mode, accentName),
      mode,
      accentName,
      setMode,
      toggleMode: () => setMode(m => (m === 'light' ? 'dark' : 'light')),
      setAccent,
    }),
    [mode, accentName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the full theme context, including the mode/accent setters. */
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
