/**
 * Admin authentication.
 *
 * SEPARATE FROM THE STUDENT APP. Two things make it separate:
 *
 *  1. A different sign-in surface — coordinators use email + password on the
 *     web; students sign in anonymously on the phone and upgrade later.
 *  2. A different authorisation check — being signed in is not enough. A uid
 *     must have an `admins/{uid}` document naming the college it administers,
 *     and that document is only writable from the Firebase console or a Cloud
 *     Function. A student who somehow reached this app still sees nothing.
 *
 * Without Firebase configured this falls back to a local demo session so the
 * dashboard is runnable. The fallback ACCEPTS ANY PASSWORD and is obviously
 * unsuitable for anything real — it is gated behind `isDemoMode()` so it can
 * never be mistaken for the production path.
 */

import { COLLEGE } from './mockData';

export type AdminSession = {
  uid: string;
  email: string;
  collegeId: string;
  collegeName: string;
  /** True when running without a real backend. */
  demo: boolean;
};

const STORAGE_KEY = 'kasrat.admin.session';

/**
 * Whether a real Firebase project is wired up.
 *
 * Vite exposes only VITE_-prefixed env vars to the client, which is the
 * mechanism that keeps server secrets out of the bundle.
 */
export function isDemoMode(): boolean {
  return !import.meta.env.VITE_FIREBASE_API_KEY;
}

export function currentSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AdminSession> {
  if (!email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (!isDemoMode()) {
    // TODO: real path — signInWithEmailAndPassword, then read admins/{uid} and
    // reject anyone without one. Deliberately not stubbed with a fake success:
    // an auth function that pretends to work is worse than one that says it
    // does not.
    throw new Error(
      'Firebase sign-in is not wired yet. Remove VITE_FIREBASE_API_KEY to use demo mode.',
    );
  }

  const session: AdminSession = {
    uid: 'demo-admin',
    email,
    collegeId: COLLEGE.id,
    collegeName: COLLEGE.name,
    demo: true,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
}
