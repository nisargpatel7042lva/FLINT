import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, AtSign, Camera, User } from 'lucide-react-native';

import {
  Avatar,
  Button,
  IconButton,
  Input,
  Screen,
  Text,
} from '../../components';
import { checkHandle, normaliseHandle } from '../../services/socialRepository';
import { useSocial } from '../../hooks';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

/** A first guess at a handle, so most people never have to think about it. */
const suggestHandle = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);

/**
 * Step 1 of profile setup: display name and handle.
 *
 * The handle is not decoration. It is the only way another person can find
 * this account to add or nudge, so it is claimed here, uniquely, before the
 * flow continues — a profile without one is invisible to everybody.
 */
export function ProfileNameScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { claimProfile } = useSocial();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  /** True once the user edits the handle, so we stop overwriting their choice. */
  const [handleTouched, setHandleTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveHandle = handleTouched ? handle : suggestHandle(name);
  const check = checkHandle(effectiveHandle);
  const canContinue =
    name.trim().length >= 2 && check.state === 'valid' && !saving;

  const onName = (next: string) => {
    setName(next);
    setError(null);
  };

  const onHandle = (next: string) => {
    setHandleTouched(true);
    setHandle(normaliseHandle(next));
    setError(null);
  };

  const submit = async () => {
    if (check.state !== 'valid') {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await claimProfile(name, check.handle);
      navigation.navigate('JoinClub');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <SetupHeader
          step={0}
          title={'What should we\ncall you?'}
          subtitle="This is how friends and teammates will find you."
        />

        <View style={styles.avatarBlock}>
          <Avatar
            name={name || undefined}
            size="xl"
            ring
            badge={
              // Image picker is a later phase — this is the affordance only.
              <IconButton accessibilityLabel="Change photo" variant="accent" size="sm">
                <Camera color={theme.colors.onAccent} size={16} />
              </IconButton>
            }
          />
          <Text variant="caption" tone="muted" style={styles.avatarHint}>
            Add a photo (optional)
          </Text>
        </View>

        <Input
          label="Display name"
          placeholder="e.g. Nisarg"
          value={name}
          onChangeText={onName}
          autoCapitalize="words"
          maxLength={24}
          iconLeft={<User color={theme.colors.textMuted} size={18} />}
          containerStyle={styles.input}
        />

        <Input
          label="Handle"
          placeholder="e.g. nisarg"
          value={effectiveHandle}
          onChangeText={onHandle}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          iconLeft={<AtSign color={theme.colors.textMuted} size={18} />}
          hint={
            check.state === 'invalid'
              ? check.reason
              : 'Friends search for you by this. It has to be unique.'
          }
          containerStyle={styles.input}
        />

        {error ? (
          <Text variant="bodySm" tone="muted" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={styles.spacer} />

        <Button
          label={saving ? 'Saving…' : 'Continue'}
          size="lg"
          fullWidth
          disabled={!canContinue}
          onPress={submit}
          iconRight={<ArrowRight color={theme.colors.onAccent} size={20} />}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  flex: { flex: 1 },
  avatarBlock: { alignItems: 'center', marginTop: 32 },
  avatarHint: { marginTop: 12 },
  input: { marginTop: 24 },
  error: { marginTop: 12 },
  spacer: { flex: 1, minHeight: 32 },
});
