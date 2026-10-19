/* eslint-env jest */
/**
 * Jest setup.
 *
 * Reanimated 4 does NOT use `react-native-reanimated/mock` — that entry
 * re-imports the real module, which pulls in react-native-worklets' native
 * initializers and throws. `jest.config.js` instead uses worklets' own resolver
 * so tests load its JS implementation.
 *
 * That resolver hands gesture-handler the "web" worklets build, which has no UI
 * runtime. gesture-handler installs UI-runtime bindings at import time, so the
 * whole package is stubbed here rather than letting it load and throw
 * `getUIRuntimeHolder is not supported on web`.
 */
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const noopGesture = () => {
    const g = {};
    for (const k of [
      'onBegin',
      'onUpdate',
      'onEnd',
      'onFinalize',
      'onStart',
      'minDistance',
      'maxDistance',
    ]) {
      g[k] = () => g;
    }
    return g;
  };
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }) => children,
    Gesture: { Pan: noopGesture, Tap: noopGesture, Race: noopGesture },
    Directions: {},
    State: {},
  };
});

/**
 * Firebase. The native modules do not exist in a JS test run, and importing
 * them throws at module load. Each is stubbed to the minimum surface the app
 * touches; `getApps()` returns [] so `isFirebaseConfigured()` is false and the
 * app exercises its local-repository path under test.
 */
jest.mock('@react-native-firebase/app', () => ({
  getApp: () => ({ name: '[DEFAULT]' }),
  getApps: () => [],
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: () => () => {},
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  linkWithCredential: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
  signOut: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  addDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(() => jest.fn()),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  onMessage: () => () => {},
  onTokenRefresh: () => () => {},
  requestPermission: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

/**
 * AsyncStorage ships ESM that Jest cannot parse, and the native module does not
 * exist in a JS test run. This version has no bundled jest mock, so a minimal
 * in-memory one stands in — enough for preferences to round-trip under test.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(key => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn(key => {
        store.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
    },
  };
});

/** Native share sheet and view capture: neither exists in a JS test run. */
jest.mock('react-native-share', () => ({ open: jest.fn(() => Promise.resolve({})) }));
jest.mock('react-native-view-shot', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, captureRef: jest.fn() };
});
