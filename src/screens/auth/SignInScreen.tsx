import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock, Mail } from 'lucide-react-native';

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
 * Log in. Auth is not wired yet — submitting jumps straight into the app so the
 * shell can be exercised.
 */
export function SignInScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const enterApp = () =>
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });

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
          Pick up where you left off.
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
          <Button label="Forgot password?" variant="ghost" size="sm" />
        </View>

        <Button
          label="Log in"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onPress={enterApp}
        />

        <Divider label="or continue with" style={styles.divider} />

        {/* Placeholder: swap the badge for the real Google mark when auth lands. */}
        <Button
          label="Continue with Google"
          variant="light"
          size="lg"
          fullWidth
          onPress={enterApp}
          iconLeft={<Avatar name="G" size="sm" />}
        />

        <View style={styles.footer}>
          <Text variant="bodySm" tone="muted">
            New to Kasrat?
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
  content: { paddingBottom: 32 },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  form: { marginTop: 24, rowGap: 16 },
  forgotRow: { alignItems: 'flex-end', marginTop: 8, marginBottom: 12 },
  divider: { marginVertical: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});
