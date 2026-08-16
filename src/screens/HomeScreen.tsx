import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRight, Bell, Clock, LayoutGrid } from 'lucide-react-native';

import {
  Avatar,
  Card,
  Chip,
  IconButton,
  Screen,
  Text,
} from '../components';
import { useTheme } from '../theme';

/**
 * Hero screen, composed entirely from the design-system primitives.
 *
 * The layout follows the supplied reference (dark page, oversized headline, one
 * accent card + one bright card, trailing CTA). Imagery in the reference is
 * licensed photography, so the media slots here are abstract token-built shapes
 * instead — drop real art in when it is available.
 */
export function HomeScreen() {
  const theme = useTheme();

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name="Sam Rivera" size="md" ring />
        <View style={styles.headerActions}>
          <IconButton accessibilityLabel="Notifications" variant="dark" size="md">
            <Bell color={theme.colors.textInverse} size={20} />
          </IconButton>
          <IconButton accessibilityLabel="More" variant="dark" size="md">
            <LayoutGrid color={theme.colors.textInverse} size={20} />
          </IconButton>
        </View>
      </View>

      <Text variant="displayLg" style={styles.hero}>
        Discipline{'\n'}is Power
      </Text>

      <Card variant="accent" padding="base" radius="xxl" style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardCopy}>
            <Chip
              label="Day Time"
              value="30m"
              variant="dark"
              icon={<Clock color={theme.colors.textInverse} size={14} />}
            />
            <Text variant="displaySm" tone="onAccent" style={styles.cardTitle}>
              Exercises{'\n'}for Men
            </Text>
          </View>
          <MediaSlot tint="rgba(0,0,0,0.18)" />
        </View>
      </Card>

      <Card variant="bright" padding="base" radius="xxl" style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardCopy}>
            <Chip
              label="Day Time"
              value="22m"
              variant="dark"
              icon={<Clock color={theme.colors.textInverse} size={14} />}
            />
            <Text variant="displaySm" tone="onBright" style={styles.cardTitle}>
              Exercises{'\n'}for Women
            </Text>
          </View>
          <MediaSlot tint="rgba(13,13,13,0.08)" />
        </View>
      </Card>

      <View style={styles.cta}>
        <Text variant="button" uppercase style={styles.ctaLabel}>
          Get Started
        </Text>
        <IconButton accessibilityLabel="Get started" variant="accent" size="lg">
          <ArrowRight color={theme.colors.onAccent} size={24} />
        </IconButton>
      </View>
    </Screen>
  );
}

/**
 * Placeholder for the card artwork. Deliberately abstract — it holds the
 * composition's proportions without standing in for licensed imagery.
 */
function MediaSlot({ tint }: { tint: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.media,
        { borderRadius: theme.radius.xl, backgroundColor: tint },
      ]}>
      <View style={[styles.mediaDot, { backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerActions: { flexDirection: 'row', columnGap: 10 },
  hero: { marginTop: 28 },
  card: { marginTop: 20 },
  cardRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { marginTop: 12 },
  media: { width: 104, height: 116, alignItems: 'center', justifyContent: 'center' },
  mediaDot: { width: 56, height: 56, borderRadius: 28 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  ctaLabel: { letterSpacing: 1.2 },
});
