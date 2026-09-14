module.exports = {
  preset: '@react-native/jest-preset',
  /**
   * Rules tests talk to the Firestore emulator and run under a plain node
   * environment, so they have their own config (jest.rules.config.js) and are
   * excluded here. `npm test` must stay runnable with nothing installed but
   * node_modules.
   */
  testPathIgnorePatterns: ['<rootDir>/__tests__/rules.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  /**
   * react-native-worklets ships a resolver that strips `.native` extensions for
   * its own files, so tests load the JS implementation instead of the native
   * module (which throws outside a real app). Reanimated depends on worklets,
   * so without this any component importing `theme/motion` fails to load.
   */
  resolver: 'react-native-worklets/jest/resolver.js',
  /**
   * lucide-react-native resolves to an untransformed `.mjs` ESM bundle under
   * Jest. Point it at the CJS build instead — cheaper and more reliable than
   * teaching Jest to transform .mjs from node_modules.
   */
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    /*
     * The Cloud Functions security helpers are plain Node and worth testing
     * here rather than standing up a second Jest inside functions/. Their only
     * runtime dependency is HttpsError, which this stub supplies.
     */
    '^firebase-functions/v2/https$': '<rootDir>/__mocks__/firebase-functions-https.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|lucide-react-native)/)',
  ],
};
