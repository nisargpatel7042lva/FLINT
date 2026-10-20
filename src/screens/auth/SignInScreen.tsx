import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';

import { Button, GoogleButton, IconButton, Input, Screen, Text } from '../../components';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { authErrorMessage, resetPassword, signInWithEmail } from '../../services';
import { useProfile } from '../../hooks';
import { useTheme } from '../../theme';

/** Log in with an existing account. */
export function SignInScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const google = useGoogleSignIn();
  const { update } = useProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithEmail(email, password);
      // An existing account has been through setup, on some phone. Without
      // this a new phone would replay the whole introduction next launch.
      update({ completed: true });
      navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'City' } }] });
    } catch (e) {
      setMessage({ text: authErrorMessage(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setMessage({ text: 'Type your email above first, then tap this again.', error: true });
      return;
    }
    try {
      await resetPassword(email);
      setMessage({ text: `A reset link is on its way to ${email.trim()}.`, error: false });
    } catch (e) {
      setMessage({ text: authErrorMessage(e), error: true });
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
          Welcome{'\n'}back
        </Text>
        <Text variant="body" tone="muted" style={styles.subtitle}>
          Your club has been running without you.
        </Text>

        <View style={styles.form}>
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
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureToggle
            autoCapitalize="none"
            iconLeft={<Lock color={theme.colors.textMuted} size={18} />}
          />
        </View>

        <View style={styles.forgotRow}>
          <Button label="Forgot password?" variant="ghost" size="sm" onPress={forgot} />
        </View>

        {message ? (
          <Text
            variant="bodySm"
            tone={message.error ? 'danger' : 'success'}
            style={styles.message}>
            {message.text}
          </Text>
        ) : null}

        <Button
          label={busy ? 'Logging in…' : 'Log in'}
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onPress={submit}
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
            New to Flint?
          </Text>
          <Button
            label="Create account"
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate('SignUp')}
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
  forgotRow: { alignItems: 'flex-end', marginTop: 8, marginBottom: 12 },
  message: { marginBottom: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});
