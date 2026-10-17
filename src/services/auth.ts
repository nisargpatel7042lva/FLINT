import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from '@react-native-firebase/auth';

import { isFirebaseConfigured, requireFirebase } from './backend';

/**
 * Authentication.
 *
 * The product deliberately lets people train before they have an account (see
 * the first-60-seconds flow), so ANONYMOUS auth is the default: a uid exists
 * from first launch, sessions are written against it, and "Save my streak"
 * later upgrades that same uid to a real credential rather than starting over.
 *
 * Without Firebase this degrades to a fixed local id so the app still runs.
 */

const LOCAL_UID = 'local-user';

export type AuthUser = { uid: string; email: string | null; isAnonymous: boolean };

export function currentUser(): AuthUser | null {
  if (!isFirebaseConfigured()) {
    return { uid: LOCAL_UID, email: null, isAnonymous: true };
  }
  const u = getAuth(requireFirebase()).currentUser;
  return u ? { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous } : null;
}

/** Resolves to a usable uid, signing in anonymously if nobody is signed in. */
export async function ensureSignedIn(): Promise<AuthUser> {
  if (!isFirebaseConfigured()) {
    return { uid: LOCAL_UID, email: null, isAnonymous: true };
  }

  const auth = getAuth(requireFirebase());
  if (auth.currentUser) {
    const u = auth.currentUser;
    return { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous };
  }

  const cred = await signInAnonymously(auth);
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    isAnonymous: cred.user.isAnonymous,
  };
}

export function watchAuth(cb: (user: AuthUser | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    cb({ uid: LOCAL_UID, email: null, isAnonymous: true });
    return () => {};
  }
  return onAuthStateChanged(getAuth(requireFirebase()), u =>
    cb(u ? { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous } : null),
  );
}

/**
 * Creates an email account.
 *
 * When somebody is already signed in anonymously — they ran, or joined a
 * club, before making an account — the email is LINKED to that same uid
 * rather than starting a new one. A new uid would orphan every run and club
 * membership they had, which is exactly the moment they decided to stay.
 */
export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  if (!isFirebaseConfigured()) {
    return { uid: LOCAL_UID, email, isAnonymous: false };
  }
  const auth = getAuth(requireFirebase());
  const clean = email.trim();
  const cred =
    auth.currentUser?.isAnonymous
      ? await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(clean, password))
      : await createUserWithEmailAndPassword(auth, clean, password);
  return { uid: cred.user.uid, email: cred.user.email, isAnonymous: false };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  if (!isFirebaseConfigured()) {
    return { uid: LOCAL_UID, email, isAnonymous: false };
  }
  const cred = await signInWithEmailAndPassword(
    getAuth(requireFirebase()),
    email.trim(),
    password,
  );
  return { uid: cred.user.uid, email: cred.user.email, isAnonymous: false };
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getAuth(requireFirebase()), email.trim());
}

/**
 * What went wrong, in words a runner can act on.
 *
 * Firebase's own messages are written for developers — "[auth/email-already-
 * in-use] The email address is already in use by another account." — and a
 * tester who sees one assumes the app is broken.
 */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'That email already has an account. Log in instead.';
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/weak-password':
      return 'Use at least 8 characters for your password.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return 'That email and password do not match.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/operation-not-allowed':
      return 'Email sign-up is switched off for now. Tell the Flint team.';
    default:
      return 'Something went wrong. Try again in a moment.';
  }
}

export async function signOut() {
  if (!isFirebaseConfigured()) {
    return;
  }
  await fbSignOut(getAuth(requireFirebase()));
}

/**
 * TODO: Google sign-in needs `@react-native-google-signin/google-signin` plus
 * an OAuth client id from the Firebase console. The UI placeholder is already
 * in SignIn/SignUp; this is the only missing piece.
 */
export async function signInWithGoogle(): Promise<never> {
  throw new Error('Google sign-in is not wired yet — see auth.ts.');
}
