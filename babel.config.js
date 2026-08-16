module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Reanimated 4 delegates its Babel transform to react-native-worklets.
    // This MUST stay last in the plugin list.
    'react-native-worklets/plugin',
  ],
};
