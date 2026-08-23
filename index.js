/**
 * @format
 */

// Must be the very first import in the app for react-native-gesture-handler.
import 'react-native-gesture-handler';

import { AppRegistry } from 'react-native';
import App from './App';
import { registerBackgroundHandler } from './src/services/messaging';
import { name as appName } from './app.json';

// Must run at module scope: a background message spins up a fresh JS context
// in which React has not mounted, so this cannot live inside a component.
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
