import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight } from 'lucide-react-native';

import { Button, Char, Screen, Text } from '../../components';
import { useTheme } from '../../theme';

/**
 * Step 1 of the first-60-seconds flow.
 *
 * Char is dim here on purpose — the whole arc is Char waking up, and it only
 * pays off if the starting state is genuinely quiet. No stats, no value props,
 * no carousel. One sentence and one button.
 */
export function SplashScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Text variant="label" tone="accent" uppercase>
          Kasrat
        </Text>
      </View>

      <View style={styles.center}>
        <Char state="dim" size={168} />
        <Text variant="displayMd" align="center" style={styles.headline}>
          This is Char.
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.body}>
          Right now it is asleep. It wakes up when you do, and it stays lit for
          as long as you keep going.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Wake it up"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('Barrier')}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
        <Text variant="caption" tone="muted" align="center" style={styles.note}>
          Takes about a minute. No account needed yet.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  top: { paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headline: { marginTop: 48 },
  body: { marginTop: 12, maxWidth: 300 },
  actions: {},
  note: { marginTop: 14 },
});
