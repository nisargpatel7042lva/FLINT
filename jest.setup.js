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
    for (const k of ['onBegin', 'onUpdate', 'onEnd', 'onFinalize', 'onStart']) {
      g[k] = () => g;
    }
    return g;
  };
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }) => children,
    Gesture: { Pan: noopGesture, Tap: noopGesture },
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
  signOut: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
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
