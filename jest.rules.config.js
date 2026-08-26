/**
 * Firestore security-rules tests.
 *
 * Separate from the app's Jest config: these run in a plain node environment
 * against the Firestore emulator, with none of the React Native preset,
 * transforms or mocks that the component tests need.
 *
 * Run via `npm run test:rules`, which starts the emulator around them.
 */
const tsTransform = [
  'babel-jest',
  {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
    ],
  },
];

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/rules.test.ts'],
  transform: {
    '^.+\\.tsx?$': tsTransform,
  },
};
