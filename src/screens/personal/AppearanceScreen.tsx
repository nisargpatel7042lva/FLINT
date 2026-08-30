import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Check, Moon, Smartphone, Sun } from 'lucide-react-native';

import {
  Card,
  Spark,
  IconButton,
  ListRow,
  PressableScale,
  Screen,
  SectionHeader,
  Text,
} from '../../components';
import { ACCENT_NAMES, accents, useTheme, useThemeContext } from '../../theme';
import type { AccentName } from '../../theme';
import type { ThemePreference } from '../../services/preferences';

const MODES: { value: ThemePreference; label: string; blurb: string }[] = [
  {
    value: 'system',
    label: 'Match my phone',
    blurb: 'Follows your device’s light or dark setting automatically.',
  },
  { value: 'light', label: 'Light', blurb: 'Cream pages, dark cards.' },
  { value: 'dark', label: 'Dark', blurb: 'Near-black pages. Easier at night.' },
];

const ACCENT_LABEL: Record<AccentName, string> = {
  orange: 'Ember',
  lime: 'Volt',
  emerald: 'Jade',
};

/** Theme settings. Stored on the device, not the account. */
export function AppearanceScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { preference, setPreference, accentName, setAccent, setTourDone } =
    useThemeContext();

  // The tile inverts against its card: an accent-coloured glyph on the accent's
  // own 'on' colour. Painting it surfaceInverse went dark-on-dark for any accent
  // whose 'on' is dark, which both Volt and Jade are.
  const iconFor = (value: ThemePreference, active: boolean) => {
    const color = active ? theme.colors.accent : theme.colors.text;
    if (value === 'system') {
      return <Smartphone color={color} size={19} />;
    }
    return value === 'light' ? (
      <Sun color={color} size={19} />
    ) : (
      <Moon color={color} size={19} />
    );
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <IconButton
        accessibilityLabel="Go back"
        variant="muted"
        size="md"
        onPress={() => navigation.goBack()}>
        <ArrowLeft color={theme.colors.text} size={20} />
      </IconButton>

      <Text variant="displaySm" style={styles.title}>
        Appearance
      </Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        Saved on this device. Changing phones will not carry it over.
      </Text>

      <SectionHeader title="Theme" style={styles.section} />
      <View style={styles.list}>
        {MODES.map(m => {
          const active = preference === m.value;
          return (
            <PressableScale
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={m.label}
              onPress={() => setPreference(m.value)}>
              <Card
                variant={active ? 'accent' : 'light'}
                padding="base"
                radius="xl">
                <View style={styles.row}>
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: active
                          ? theme.colors.onAccent
                          : theme.colors.surfaceMuted,
                        borderRadius: theme.radius.md,
                      },
                    ]}>
                    {iconFor(m.value, active)}
                  </View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" tone={active ? 'onAccent' : 'default'}>
                      {m.label}
                    </Text>
                    <Text
                      variant="caption"
                      tone={active ? 'onAccent' : 'muted'}
                      style={styles.blurb}>
                      {m.blurb}
                    </Text>
                  </View>
                  {active ? (
                    <Check color={theme.colors.onAccent} size={20} strokeWidth={3} />
                  ) : null}
                </View>
              </Card>
            </PressableScale>
          );
        })}
      </View>

      <SectionHeader
        title="Accent"
        subtitle="Used for your spark, streaks and every highlight"
        style={styles.section}
      />
      <View style={styles.accents}>
        {ACCENT_NAMES.map(name => {
          const active = accentName === name;
          return (
            <PressableScale
              key={name}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={ACCENT_LABEL[name]}
              onPress={() => setAccent(name)}
              style={styles.accentItem}>
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: accents[name].base,
                    borderColor: active ? theme.colors.text : TRANSPARENT,
                  },
                ]}>
                {active ? (
                  <Check color={accents[name].on} size={20} strokeWidth={3} />
                ) : null}
              </View>
              <Text variant="caption" tone={active ? 'default' : 'muted'}>
                {ACCENT_LABEL[name]}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Live preview, so the choice is visible before leaving the screen. */}
      <Card variant="dark" padding="lg" radius="xxl" style={styles.preview}>
        <View style={styles.previewRow}>
          <Spark state="glowing" size={72} />
          <View style={styles.flex}>
            <Text variant="label" tone="inverseMuted" uppercase>
              Preview
            </Text>
            <Text variant="h2" tone="inverse" style={styles.previewTitle}>
              Lit
            </Text>
            <Text variant="caption" tone="inverseMuted">
              This card is always dark — a spark needs a dark ground to read as lit.
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader title="Help" style={styles.section} />
      <ListRow
        filled
        title="Replay the walkthrough"
        subtitle="Show the guided tour again next time you open Home"
        onPress={() => {
          setTourDone(false);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

const TRANSPARENT = 'transparent';

const styles = StyleSheet.create({
  content: { paddingBottom: 160 },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  section: { marginTop: 30 },
  list: { marginTop: 12, rowGap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  iconWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  blurb: { marginTop: 2 },
  accents: { flexDirection: 'row', columnGap: 18, marginTop: 14 },
  accentItem: { alignItems: 'center', rowGap: 8 },
  swatch: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { marginTop: 26 },
  previewRow: { flexDirection: 'row', alignItems: 'center', columnGap: 16 },
  previewTitle: { marginTop: 2, marginBottom: 4 },
});
