import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, PressableScale, Screen, Text } from '../../components';
import { BARRIERS, type Barrier } from '../../services';
import { placeholderPhoto, remote } from '../../assets/placeholders';
import { useTheme } from '../../theme';

/**
 * Step 2: name the obstacle.
 *
 * Asking this before offering anything is the point — the next screen answers
 * the specific thing they picked. "No time" gets the tall card because it is
 * the dominant survey answer, but the other three are full-size and equally
 * tappable, not hidden behind a "more options" link.
 */
export function BarrierScreen() {
  const navigation = useNavigation();

  const primary = BARRIERS.find(b => b.weight === 'primary');
  const rest = BARRIERS.filter(b => b.weight !== 'primary');

  const go = (b: Barrier) => navigation.navigate('CharReaction', { barrierId: b.id });

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <Text variant="label" tone="accent" uppercase style={styles.eyebrow}>
        Be honest
      </Text>
      <Text variant="displaySm" style={styles.title}>
        What's actually{'\n'}stopping you right now?
      </Text>

      {primary ? <BarrierCard barrier={primary} tall onPress={() => go(primary)} /> : null}

      <View style={styles.grid}>
        {rest.map(b => (
          <BarrierCard key={b.id} barrier={b} onPress={() => go(b)} />
        ))}
      </View>
    </Screen>
  );
}

function BarrierCard({
  barrier,
  tall = false,
  onPress,
}: {
  barrier: Barrier;
  tall?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={barrier.title}
      onPress={onPress}
      style={tall ? styles.tallWrap : styles.cardWrap}>
      <Card
        variant={tall ? 'accent' : 'light'}
        padding="base"
        radius="xxl"
        style={tall ? styles.tall : styles.card}>
        {/* PLACEHOLDER: replace with real illustrations for each barrier. */}
        <Image
          source={remote(
            placeholderPhoto('gym', barrier.id, tall ? 640 : 360, tall ? 320 : 240),
          )}
          style={[
            tall ? styles.tallImage : styles.image,
            { borderRadius: theme.radius.lg },
          ]}
          resizeMode="cover"
        />
        <Text
          variant={tall ? 'h1' : 'h3'}
          tone={tall ? 'onAccent' : 'default'}
          style={styles.cardTitle}>
          {barrier.title}
        </Text>
        <Text
          variant={tall ? 'bodySm' : 'caption'}
          tone={tall ? 'onAccent' : 'muted'}
          style={styles.cardBlurb}>
          {barrier.blurb}
        </Text>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  eyebrow: { paddingTop: 12 },
  title: { marginTop: 6 },
  tallWrap: { marginTop: 24 },
  tall: {},
  tallImage: { width: '100%', height: 132 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12, marginTop: 12 },
  cardWrap: { flexGrow: 1, flexBasis: '46%' },
  card: { flex: 1 },
  image: { width: '100%', height: 84 },
  cardTitle: { marginTop: 12 },
  cardBlurb: { marginTop: 4 },
});
