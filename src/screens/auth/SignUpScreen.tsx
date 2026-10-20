import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';

import { Button, GoogleButton, IconButton, Input, Screen, Text } from '../../components';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { authErrorMessage, signUpWithEmail } from '../../services';
import { useTheme } from '../../theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Account creation: email and password, nothing else.
 *
 * The name and handle come on the next screen, where they are explained. Asking
 * for them here as well would be asking twice.
 */
export function SignUpScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = EMAIL.test(email.trim());
  const canSubmit = emailOk && password.length >= 8 && !saving;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await signUpWithEmail(email, password);
      navigation.navigate('ProfileName');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

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
          So your runs, your club and your blocks follow you to a new phone.
        </Text>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={t => {
              setEmail(t);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            iconLeft={<Mail color={theme.colors.textMuted} size={18} />}
          />
          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={t => {
              setPassword(t);
              setError(null);
            }}
            secureToggle
            autoCapitalize="none"
            iconLeft={<Lock color={theme.colors.textMuted} size={18} />}
            hint="Use 8 or more characters."
          />
        </View>

        {error ? (
          <Text variant="bodySm" tone="danger" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          label={saving ? 'Creating…' : 'Create account'}
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onPress={submit}
          style={styles.submit}
        />

        <View style={styles.orRow}>
          <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
          <Text variant="caption" tone="muted">
            or
          </Text>
          <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
        </View>
        <GoogleButton onPress={google.go} disabled={google.busy} />
        {google.error ? (
          <Text variant="bodySm" tone="danger" style={styles.googleError}>
            {google.error}
          </Text>
        ) : null}

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
  orRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12, marginVertical: 18 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  googleError: { marginTop: 10 },
  content: { paddingBottom: 32 },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  form: { marginTop: 24, rowGap: 16 },
  error: { marginTop: 16 },
  submit: { marginTop: 24 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});
