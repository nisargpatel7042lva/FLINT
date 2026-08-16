import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock, Mail, User } from 'lucide-react-native';

import {
  Avatar,
  Button,
  Divider,
  IconButton,
  Input,
  Screen,
  Text,
} from '../../components';
import { useTheme } from '../../theme';

/**
 * Account creation. Auth is not wired yet — submitting advances the flow so the
 * rest of onboarding can be walked end to end.
 */
export function SignUpScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  return (
    <Screen scroll padding="lg" contentContainerStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <IconButton
          accessibilityLabel="Go back"
          variant="muted"
          size="md"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.colors.text} size={20} />
        </IconButton>

        <Text variant="displaySm" style={styles.title}>
          Create your{'\n'}account
        </Text>
        <Text variant="body" tone="muted" style={styles.subtitle}>
          Start tracking, challenge friends, and join a team.
        </Text>

        <View style={styles.form}>
          <Input
            label="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            textContentType="name"
            iconLeft={<User color={theme.colors.textMuted} size={18} />}
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            iconLeft={<Mail color={theme.colors.textMuted} size={18} />}
          />
          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureToggle
            autoCapitalize="none"
            iconLeft={<Lock color={theme.colors.textMuted} size={18} />}
            hint="Use 8 or more characters."
          />
        </View>

        <Button
          label="Create account"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onPress={() => navigation.navigate('ProfileName')}
          style={styles.submit}
        />

        <Divider label="or continue with" style={styles.divider} />

        {/* Placeholder: swap the badge for the real Google mark when auth lands. */}
        <Button
          label="Continue with Google"
          variant="light"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('ProfileName')}
          iconLeft={<Avatar name="G" size="sm" />}
        />

        <View style={styles.footer}>
          <Text variant="bodySm" tone="muted">
            Already have an account?
          </Text>
          <Button
            label="Log in"
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate('SignIn')}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  form: { marginTop: 24, rowGap: 16 },
  submit: { marginTop: 24 },
  divider: { marginVertical: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});
