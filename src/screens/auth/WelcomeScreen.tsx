import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Play } from 'lucide-react-native';

import {
  AvatarGroup,
  Button,
  Card,
  IconButton,
  ProgressRing,
  Screen,
  StatPill,
  Text,
} from '../../components';
import { useTheme } from '../../theme';

/**
 * Splash / welcome hero.
 *
 * Mirrors the reference's "Stay Healthy Keep Body Strong" treatment: stacked
 * display type with one word boxed in the accent. The boxed word is a `Card`
 * with pill radius rather than a bespoke style, so it stays on-token.
 */
export function WelcomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Text variant="label" tone="accent" uppercase>
          Kasrat
        </Text>

        <Text variant="displayLg" style={styles.headline}>
          Stay Healthy{'\n'}Keep Body
        </Text>

        <View style={styles.highlightRow}>
          <Card
            variant="accent"
            radius="pill"
            padding="sm"
            elevation="none"
            style={styles.highlight}>
            <Text variant="displayLg" tone="onAccent">
              Strong
            </Text>
          </Card>
        </View>
      </View>

      {/* Visual anchor: a real progress ring + stats, not decorative filler. */}
      <View style={styles.showcase}>
        <ProgressRing value={72} max={100} size={150} strokeWidth={14} sweep={290}>
          <Text variant="statMd">72%</Text>
          <Text variant="label" tone="muted" uppercase>
            Weekly
          </Text>
        </ProgressRing>

        <View style={styles.showcaseSide}>
          <StatPill value="119" label="bpm" variant="dark" size="sm" />
          <IconButton accessibilityLabel="Preview workout" variant="accent" size="lg">
            <Play color={theme.colors.onAccent} size={22} fill={theme.colors.onAccent} />
          </IconButton>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.social}>
        <AvatarGroup
          names={['Ava Cole', 'Ben Ortiz', 'Cara Diaz', 'Dan Reed', 'Eve Shah', 'Finn Wu']}
          max={4}
          size="sm"
        />
        <Text variant="bodySm" tone="muted" style={styles.socialText}>
          21 people trained here today
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Get Started"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('Onboarding')}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
        <Button
          label="I already have an account"
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.navigate('SignIn')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  top: { paddingTop: 16 },
  headline: { marginTop: 10 },
  highlightRow: { flexDirection: 'row', marginTop: 6 },
  highlight: { paddingHorizontal: 18 },
  showcase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 36,
  },
  spacer: { flex: 1, minHeight: 24 },
  showcaseSide: { alignItems: 'flex-end', rowGap: 16 },
  social: { flexDirection: 'row', alignItems: 'center', columnGap: 10, marginBottom: 20 },
  socialText: { flex: 1 },
  actions: { rowGap: 4 },
});
