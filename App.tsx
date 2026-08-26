/**
 * Kasrat — app root.
 *
 * Provider order matters:
 *   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → navigation
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme';
import { TourProvider } from './src/components';

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* Mode and accent now come from the user's stored preference. */}
        <ThemeProvider>
          <TourProvider>
            <RootNavigator />
          </TourProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
