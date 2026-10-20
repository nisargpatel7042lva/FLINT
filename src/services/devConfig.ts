/**
 * Development switches. Every value here must be off in a commit — a test
 * (__tests__/devConfig.test.ts) fails if one is left on.
 */

/**
 * Point the debug app at the local Firebase emulators (auth + Firestore)
 * instead of the live project, so flows can be exercised end to end without
 * writing test data into real users' database. Start them with
 * `npx firebase emulators:start --only auth,firestore`.
 */
export const USE_EMULATORS = false;

/** From the Android emulator, the host machine is 10.0.2.2. */
export const EMULATOR_HOST = '10.0.2.2';
