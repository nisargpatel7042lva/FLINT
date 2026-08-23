import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
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

export async function signUpWithEmail(email: string, password: string) {
  const auth = getAuth(requireFirebase());
  // TODO: when the current user is anonymous, link the credential instead of
  // creating a new account, so the streak earned before signup survives.
  // `linkWithCredential(auth.currentUser, EmailAuthProvider.credential(...))`.
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getAuth(requireFirebase()), email, password);
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
