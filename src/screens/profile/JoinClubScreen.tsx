import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Share, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Flag, Hash, Share2 } from 'lucide-react-native';

import { Button, Card, Input, Screen, SegmentedControl, Text } from '../../components';
import { useProfile, useSocial } from '../../hooks';
import { normaliseCode } from '../../services/socialRepository';
import { friendlyError, reportFailure } from '../../services/feedback';
import type { Group } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'join' | 'start';

/** The message an organiser pastes into their club's WhatsApp group. */
export const inviteMessage = (club: Group) =>
  `${club.name} is on Flint. Every run we do lights up our blocks on the city map, and the club with the most runs through a block owns it.\n\nJoin with code ${club.code}\nGet the app: https://use-flint.web.app`;

/**
 * Last setup step: get into a club.
 *
 * Flint is a club game. Someone who finishes setup without a club opens a map
 * they cannot light, so this step leads — but it can be skipped, because a
 * runner whose club has not joined yet should still be able to record runs.
 */
export function JoinClubScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { joinGroup, createGroup } = useSocial();
  const { profile, update } = useProfile();

  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [club, setClub] = useState<{ group: Group; started: boolean } | null>(null);

  /*
   * In setup, the alerts step comes next. Reached later from Home, the person
   * has been through setup already — back to the city, no second primer.
   */
  const finish = () => {
    if (!profile.completed) {
      navigation.navigate('AlertsPrimer');
      return;
    }
    update({ completed: true });
    navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'City' } }] });
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await joinGroup(normaliseCode(code));
      if (result.state === 'unknown') {
        setError('No club matches that code. Check it with your organiser.');
        return;
      }
      setClub({ group: result.group, started: false });
    } catch (e) {
      reportFailure('JoinClub', 'join club', e);
      setError(friendlyError(e, 'Joining a club'));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(name.trim(), 'club');
      setClub({ group, started: true });
    } catch (e) {
      reportFailure('JoinClub', 'start club', e);
      setError(friendlyError(e, 'Starting a club'));
    } finally {
      setBusy(false);
    }
  };

  if (club) {
    return (
      <Screen padding="lg" contentContainerStyle={styles.doneContent}>
        <SetupHeader
          step={2}
          title={club.started ? `${club.group.name}\nis live` : `You're in\n${club.group.name}`}
          subtitle={
            club.started
              ? 'Share the code with your runners. Every run they do lights blocks for the club.'
              : 'Every run you do now lights blocks for your club.'
          }
        />
        {club.started ? (
          <Card variant="dark" padding="lg" radius="xxl" style={styles.codeCard}>
            <Text variant="label" tone="inverseMuted" uppercase>
              Club code
            </Text>
            <Text variant="displayMd" tone="inverse" style={styles.code}>
              {club.group.code}
            </Text>
            <Button
              label="Share with the club"
              variant="primary"
              size="md"
              onPress={() => Share.share({ message: inviteMessage(club.group) }).catch(() => {})}
              iconLeft={<Share2 color={theme.colors.onAccent} size={16} />}
              style={styles.share}
            />
          </Card>
        ) : null}
        <View style={styles.spacer} />
        <Button label="See the city" size="lg" fullWidth onPress={finish} />
      </Screen>
    );
  }

  const canSubmit =
    !busy && (mode === 'join' ? normaliseCode(code).length >= 6 : name.trim().length >= 2);

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <SetupHeader
          step={2}
          title={'Find your\nrun club'}
          subtitle="Your runs light up the city for your club. Ask your organiser for the code."
        />

        <SegmentedControl<Mode>
          value={mode}
          onChange={v => {
            setMode(v);
            setError(null);
          }}
          segments={[
            { value: 'join', label: 'I have a code' },
            { value: 'start', label: 'Start a club' },
          ]}
          style={styles.segment}
        />

        {mode === 'join' ? (
          <Input
            label="Club code"
            placeholder="e.g. RISE44"
            value={code}
            onChangeText={t => {
              setCode(t.toUpperCase());
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            iconLeft={<Hash color={theme.colors.textMuted} size={18} />}
            containerStyle={styles.input}
          />
        ) : (
          <Input
            label="Club name"
            placeholder="e.g. Sunrise Runners Vadodara"
            value={name}
            onChangeText={t => {
              setName(t);
              setError(null);
            }}
            autoCapitalize="words"
            maxLength={60}
            iconLeft={<Flag color={theme.colors.textMuted} size={18} />}
            hint="This is the name other clubs see on the map."
            containerStyle={styles.input}
          />
        )}

        {error ? (
          <Text variant="bodySm" tone="danger" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.spacer} />

        <Button
          label={
            busy ? 'One moment…' : mode === 'join' ? 'Join club' : 'Start club'
          }
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onPress={mode === 'join' ? join : start}
        />
        <Button
          label="My club isn't on Flint yet"
          variant="ghost"
          size="md"
          fullWidth
          onPress={finish}
          style={styles.skip}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 28 },
  doneContent: { flex: 1, paddingBottom: 28 },
  flex: { flex: 1 },
  segment: { marginTop: 28 },
  input: { marginTop: 20 },
  error: { marginTop: 12 },
  spacer: { flex: 1, minHeight: 32 },
  skip: { marginTop: 8 },
  codeCard: { marginTop: 28, alignItems: 'flex-start' },
  code: { marginTop: 6, letterSpacing: 4 },
  share: { marginTop: 18 },
});
