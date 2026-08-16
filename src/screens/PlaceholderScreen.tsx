import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { Screen, Text } from '../components';

/**
 * Intentionally empty. Real screens land in a later phase — this exists only so
 * every tab has something to mount while the shell is verified.
 */
export function PlaceholderScreen() {
  const route = useRoute();

  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="displaySm" align="center">
          {route.name}
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.sub}>
          Screen not built yet.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sub: { marginTop: 8 },
});
