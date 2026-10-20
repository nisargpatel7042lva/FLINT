import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
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
    case 'auth/missing-id-token':
    case '12500':
    case 'DEVELOPER_ERROR':
      return 'Google sign-in is not set up for this build. Use email for now and tell the Flint team.';
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
 * The OAuth "web" client of the Firebase project. Not a secret: it is in
 * google-services.json and in every copy of the app. Google issues an ID
 * token for it, and Firebase Auth accepts that token.
 */
const GOOGLE_WEB_CLIENT_ID =
  '371073522433-au3hbot5fm0lgctn5c8jpfpft0kpccj7.apps.googleusercontent.com';

let googleConfigured = false;

export type GoogleResult =
  | { state: 'signed-in'; user: AuthUser; isNew: boolean }
  | { state: 'cancelled' };

/**
 * Sign in (or up) with Google.
 *
 * Like email sign-up, an anonymous user is LINKED rather than replaced, so
 * runs and clubs from before signing in keep their owner. If that Google
 * account already belongs to someone on Flint, linking is refused and we sign
 * into that existing account instead — the person is logging back in.
 *
 * Works only when the APK's signing key is registered with the Firebase app
 * (both the debug and the release key are).
 */
export async function signInWithGoogle(): Promise<GoogleResult> {
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Always show the account picker, rather than silently reusing the last one.
  await GoogleSignin.signOut().catch(() => null);

  let idToken: string | null = null;
  try {
    const res = await GoogleSignin.signIn();
    if (res.type === 'cancelled') {
      return { state: 'cancelled' };
    }
    idToken = res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) {
      return { state: 'cancelled' };
    }
    throw e;
  }
  if (!idToken) {
    throw Object.assign(new Error('Google did not return a token'), {
      code: 'auth/missing-id-token',
    });
  }

  const auth = getAuth(requireFirebase());
  const credential = GoogleAuthProvider.credential(idToken);
  const current = auth.currentUser;

  if (current?.isAnonymous) {
    try {
      const linked = await linkWithCredential(current, credential);
      return {
        state: 'signed-in',
        user: { uid: linked.user.uid, email: linked.user.email, isAnonymous: false },
        isNew: true,
      };
    } catch (e) {
      const code = (e as { code?: string } | null)?.code ?? '';
      if (!code.includes('credential-already-in-use')) {
        throw e;
      }
      // This Google account is already on Flint: log into it instead.
    }
  }

  const cred = await signInWithCredential(auth, credential);
  return {
    state: 'signed-in',
    user: { uid: cred.user.uid, email: cred.user.email, isAnonymous: false },
    isNew: Boolean(cred.additionalUserInfo?.isNewUser),
  };
}
