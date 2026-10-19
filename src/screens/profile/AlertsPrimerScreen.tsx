import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flame, Hand } from 'lucide-react-native';

import { Button, Card, Logo, Screen, Text } from '../../components';
import { useProfile, useSocial } from '../../hooks';
import { registerForNudges } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Why Flint wants to send notifications — shown before Android asks.
 *
 * The system prompt says only "Allow Flint to send you notifications?", and
 * most people refuse a question with no reason attached. Showing the actual
 * notifications first turns it into a choice about something they can see:
 * a steal they would want to hear about, a nudge from a clubmate.
 */
export function AlertsPrimerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { update } = useProfile();
  const { uid, groups } = useSocial();
  const [busy, setBusy] = useState(false);

  const club = groups.find(g => g.kind === 'club');
  const rival = club ? 'Night Owls' : 'Another club';

  const finish = () => {
    update({ completed: true });
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'City' } }] });
  };

  const allow = async () => {
    setBusy(true);
    try {
      if (uid) {
        await registerForNudges(uid);
      }
    } catch {
      // Refused or offline: the app works without pushes, just quieter.
    } finally {
      setBusy(false);
      finish();
    }
  };

  return (
    <Screen padding="lg" contentContainerStyle={styles.content}>
      <View style={styles.flex}>
        <Text variant="displaySm" style={styles.title}>
          Know when your{'\n'}blocks are taken
        </Text>
        <Text variant="body" tone="muted" style={styles.subtitle}>
          Two kinds of alert, and only these. No ads, no daily reminders.
        </Text>

        <View style={styles.notifications}>
          <Notification
            icon={<Flame color={theme.colors.accent} size={18} />}
            title={`${rival} took 3 of your blocks`}
            body="Run through them this week to win them back."
            time="now"
          />
          <Notification
            icon={<Hand color={theme.colors.accent} size={18} />}
            title="Priya nudged you"
            body={club ? `${club.name} is out at 6. You coming?` : 'Your club is out at 6. You coming?'}
            time="2h"
          />
        </View>
      </View>

      <Button
        label={busy ? 'One moment…' : 'Turn on alerts'}
        size="lg"
        fullWidth
        disabled={busy}
        onPress={allow}
      />
      <Button label="Not now" variant="ghost" size="md" fullWidth onPress={finish} style={styles.skip} />
    </Screen>
  );
}

/** A lock-screen notification, drawn — so the prompt that follows has a reason. */
function Notification({
  icon,
  title,
  body,
  time,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  time: string;
}) {
  return (
    <Card variant="dark" padding="base" radius="xl">
      <View style={styles.notifHead}>
        <Logo size={16} />
        <Text variant="caption" tone="inverseMuted" style={styles.flex}>
          Flint
        </Text>
        <Text variant="caption" tone="inverseMuted">
          {time}
        </Text>
      </View>
      <View style={styles.notifBody}>
        {icon}
        <View style={styles.flex}>
          <Text variant="bodyStrong" tone="inverse">
            {title}
          </Text>
          <Text variant="bodySm" tone="inverseMuted">
            {body}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: 24 },
  flex: { flex: 1 },
  title: { marginTop: 40 },
  subtitle: { marginTop: 10 },
  notifications: { marginTop: 32, rowGap: 12 },
  notifHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  notifBody: { flexDirection: 'row', columnGap: 12, marginTop: 10 },
  skip: { marginTop: 6 },
});
