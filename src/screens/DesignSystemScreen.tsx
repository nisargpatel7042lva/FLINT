import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ArrowRight,
  Bell,
  Flame,
  Footprints,
  Heart,
  Search,
  Zap,
} from 'lucide-react-native';

import {
  Button,
  Card,
  IconButton,
  Input,
  ProgressRing,
  Screen,
  SectionHeader,
  StatPill,
  Text,
} from '../components';
import { useTheme, useThemeContext, type AccentName } from '../theme';

const ACCENTS: AccentName[] = ['orange', 'lime', 'emerald'];

/**
 * A living gallery of the design system. Not a product screen — it exists to
 * verify the tokens and primitives render correctly on device, and it doubles
 * as the reference for what is available when real screens get built.
 */
export function DesignSystemScreen() {
  const theme = useTheme();
  const { mode, accentName, toggleMode, setAccent } = useThemeContext();

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text variant="label" tone="accent" uppercase>
            Kasrat
          </Text>
          <Text variant="displayMd" style={styles.title}>
            Discipline{'\n'}is Power
          </Text>
        </View>
        <IconButton accessibilityLabel="Notifications" variant="dark">
          <Bell color={theme.colors.textInverse} size={20} />
        </IconButton>
      </View>

      {/* Theme switches */}
      <Card variant="light" padding="base" elevation="sm" style={styles.block}>
        <SectionHeader title="Theme" subtitle={`${mode} · ${accentName}`} />
        <View style={styles.rowWrap}>
          <Button label={`Mode: ${mode}`} variant="outline" size="sm" onPress={toggleMode} />
          {ACCENTS.map(a => (
            <Button
              key={a}
              label={a}
              size="sm"
              variant={a === accentName ? 'primary' : 'outline'}
              onPress={() => setAccent(a)}
            />
          ))}
        </View>
      </Card>

      {/* Progress ring + stats */}
      <Card variant="dark" style={styles.block}>
        <SectionHeader title="Today" actionLabel="See All" onDark />
        <View style={styles.ringRow}>
          <ProgressRing value={78} max={100} size={132} strokeWidth={13} sweep={300}>
            <Text variant="statMd" tone="inverse">
              78%
            </Text>
            <Text variant="label" tone="inverseMuted" uppercase>
              Goals
            </Text>
          </ProgressRing>

          <View style={styles.statStack}>
            <StatPill
              value="6,160"
              label="Steps"
              variant="muted"
              size="sm"
              icon={<Footprints color={theme.colors.accent} size={16} />}
            />
            <StatPill
              value="638"
              label="Kcal"
              variant="muted"
              size="sm"
              icon={<Flame color={theme.colors.accent} size={16} />}
            />
          </View>
        </View>
      </Card>

      {/* Stat pill variants */}
      <SectionHeader title="Stats" style={styles.block} />
      <View style={styles.rowWrap}>
        <StatPill
          value={112}
          label="bpm"
          variant="dark"
          icon={<Heart color={theme.colors.accent} size={18} />}
        />
        <StatPill value="4h 20m" label="Duration" variant="light" />
        <StatPill value="9,993" label="Points" variant="accent" />
      </View>

      {/* Cards */}
      <SectionHeader title="Cards" style={styles.block} />
      <View style={styles.stack}>
        <Card variant="accent" padding="base">
          <Text variant="caption" tone="onAccent">
            Day Time · 30m
          </Text>
          <Text variant="h1" tone="onAccent">
            Accent card
          </Text>
        </Card>
        <Card variant="light" padding="base">
          <Text variant="h2">Light card</Text>
          <Text variant="bodySm" tone="muted">
            Sits on the cream page background.
          </Text>
        </Card>
        <Card variant="outline" padding="base">
          <Text variant="h2">Outline card</Text>
          <Text variant="bodySm" tone="muted">
            No fill, hairline border.
          </Text>
        </Card>
      </View>

      {/* Buttons */}
      <SectionHeader title="Buttons" style={styles.block} />
      <View style={styles.rowWrap}>
        <Button label="Primary" />
        <Button label="Dark" variant="dark" />
        <Button label="Light" variant="light" />
        <Button label="Outline" variant="outline" />
        <Button label="Ghost" variant="ghost" />
        <Button label="Loading" loading />
        <Button label="Disabled" disabled />
      </View>
      <Button
        label="Get Started"
        size="lg"
        fullWidth
        style={styles.cta}
        iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
      />

      {/* Icon buttons */}
      <SectionHeader title="Icon buttons" style={styles.block} />
      <View style={styles.rowWrap}>
        <IconButton accessibilityLabel="Boost" variant="accent">
          <Zap color={theme.colors.onAccent} size={20} />
        </IconButton>
        <IconButton accessibilityLabel="Dark" variant="dark">
          <Zap color={theme.colors.textInverse} size={20} />
        </IconButton>
        <IconButton accessibilityLabel="Light" variant="light">
          <Zap color={theme.colors.text} size={20} />
        </IconButton>
      </View>

      {/* Input */}
      <SectionHeader title="Input" style={styles.block} />
      <View style={styles.stack}>
        <Input
          label="Search"
          placeholder="Find a workout"
          iconLeft={<Search color={theme.colors.textMuted} size={18} />}
        />
        <Input label="With error" placeholder="0" error="Enter a valid number" />
      </View>

      {/* Typography */}
      <SectionHeader title="Type scale" style={styles.block} />
      <View style={styles.stack}>
        <Text variant="displayLg">Display Lg</Text>
        <Text variant="displaySm">Display Sm</Text>
        <Text variant="h1">Heading 1</Text>
        <Text variant="h3">Heading 3</Text>
        <Text variant="body">Body — clean sans for reading.</Text>
        <Text variant="bodySm" tone="muted">
          Body small, muted.
        </Text>
        <Text variant="label" tone="muted" uppercase>
          Label
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  title: { marginTop: 4 },
  block: { marginTop: 28 },
  stack: { marginTop: 12, rowGap: 12 },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
    marginTop: 16,
  },
  statStack: { rowGap: 10, flex: 1 },
  cta: { marginTop: 12 },
});
