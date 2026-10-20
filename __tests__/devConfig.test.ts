import { USE_EMULATORS } from '../src/services/devConfig';

it('never ships pointed at the local emulators', () => {
  expect(USE_EMULATORS).toBe(false);
});
