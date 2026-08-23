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
