import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight } from 'lucide-react-native';

import { AnimatedCounter, Button, Char, Screen, Slider, Text } from '../../components';
import { useTheme } from '../../theme';

const MIN = 5;
const MAX = 30;

/**
 * Step 4: the time budget.
 *
 * Deliberately phrased "actually have today" rather than "want to train for".
 * The number is the input to workout generation, so it is the largest thing on
 * screen and updates live as the thumb moves (rule 3 — counters tween rather
 * than snap).
 */
export function TimeBudgetScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [minutes, setMinutes] = useState(10);

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        Today only
      </Text>
      <Text variant="displaySm" style={styles.title}>
        How many minutes{'\n'}do you actually have?
      </Text>

      <View style={styles.center}>
        <Char state="glowing" size={116} style={styles.char} />

        <View style={styles.readout}>
          <AnimatedCounter
            value={minutes}
            variant="statLg"
            tone="accent"
            durationMs={220}
          />
          <Text variant="h3" tone="muted" style={styles.unit}>
            min
          </Text>
        </View>

        <Slider
          value={minutes}
          min={MIN}
          max={MAX}
          step={1}
          onChange={setMinutes}
          onDark
          style={styles.slider}
        />

        <View style={styles.scale}>
          <Text variant="caption" tone="muted">
            {MIN} min
          </Text>
          <Text variant="caption" tone="muted">
            {MAX} min
          </Text>
        </View>

        <Text variant="bodySm" tone="muted" align="center" style={styles.hint}>
          {minutes <= 8
            ? 'Short is fine. Short and done beats long and skipped.'
            : minutes <= 18
            ? 'Enough for a real session without rearranging your day.'
            : 'Ambitious. I will make every minute count.'}
        </Text>
      </View>

      <Button
        label={`Build my ${minutes}-minute session`}
        size="lg"
        fullWidth
        onPress={() => navigation.navigate('FirstWorkout', { minutes })}
        iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  eyebrow: { paddingTop: 12 },
  title: { marginTop: 6 },
  center: { flex: 1, justifyContent: 'center' },
  char: { alignSelf: 'center' },
  readout: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 8,
    marginTop: 32,
  },
  unit: { marginBottom: 10 },
  slider: { marginTop: 28 },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  hint: { marginTop: 24, alignSelf: 'center', maxWidth: 300 },
});
