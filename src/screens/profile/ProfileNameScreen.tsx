import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, Camera, User } from 'lucide-react-native';

import {
  Avatar,
  Button,
  IconButton,
  Input,
  Screen,
  Text,
} from '../../components';
import { useTheme } from '../../theme';
import { SetupHeader } from './SetupHeader';

/** Step 1 of profile setup: display name and avatar. */
export function ProfileNameScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [name, setName] = useState('');

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
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={24}
          iconLeft={<User color={theme.colors.textMuted} size={18} />}
          hint="You can change this any time."
          containerStyle={styles.input}
        />

        <View style={styles.spacer} />

        <Button
          label="Continue"
          size="lg"
          fullWidth
          disabled={name.trim().length < 2}
          onPress={() => navigation.navigate('ProfileGoal')}
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
  input: { marginTop: 32 },
  spacer: { flex: 1, minHeight: 32 },
});
