import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';

import { Button, Char, Screen, Text } from '../../components';
import { barrierById } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { duration, useTheme } from '../../theme';

/**
 * Step 3: Char answers the specific barrier.
 *
 * The copy is written per barrier in `services/onboarding.ts` and directly
 * addresses what was picked — "Then we never ask for an hour" for No time, not
 * a generic acknowledgement. Char transitions dim → glowing here, its first
 * sign of life, timed so the movement lands before the text arrives.
 */
export function CharReactionScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'CharReaction'>>();
  const barrier = barrierById(route.params.barrierId);

  // Char starts dim and wakes a beat after the screen settles, so the change
  // is something you watch happen rather than something already done.
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAwake(true), duration.slow);
    return () => clearTimeout(t);
  }, []);

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.center}>
        <Char state={awake ? barrier.response.charState : 'dim'} size={148} />

        <Animated.View entering={FadeInDown.delay(duration.deliberate).duration(duration.slow)}>
          <Text variant="displaySm" align="center" style={styles.line}>
            {barrier.response.line}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(duration.deliberate + duration.base).duration(duration.slow)}>
          <Text variant="body" tone="muted" align="center" style={styles.detail}>
            {barrier.response.detail}
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(duration.deliberate + duration.slow)}>
        <Button
          label="Keep going"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('TimeBudget')}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  line: { marginTop: 44, maxWidth: 320 },
  detail: { marginTop: 14, maxWidth: 320 },
});
