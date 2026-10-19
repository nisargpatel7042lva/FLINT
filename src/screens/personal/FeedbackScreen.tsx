import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Check } from 'lucide-react-native';

import { Button, IconButton, Input, Screen, SegmentedControl, Text } from '../../components';
import { APP_BUILD, APP_VERSION, deviceLabel, sendFeedback, type FeedbackKind } from '../../services';
import { useTheme } from '../../theme';

/**
 * "Report a problem" for beta testers.
 *
 * Short on purpose: a tester who hits a bug mid-morning will write one
 * sentence or nothing, so there is one box and one button. The build and the
 * phone are attached automatically — they are the two things every report
 * needs and nobody remembers to include.
 */
export function FeedbackScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    setState('sending');
    try {
      await sendFeedback({ message, kind, screen: 'Profile' });
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  if (state === 'sent') {
    return (
      <Screen padding="lg" center>
        <Check color={theme.colors.accent} size={40} />
        <Text variant="h2" align="center" style={styles.sentTitle}>
          Got it. Thank you.
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.sentBody}>
          Every report is read by the people building Flint.
        </Text>
        <Button label="Back" size="md" onPress={() => navigation.goBack()} style={styles.back} />
      </Screen>
    );
  }

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
          Tell us what{'\n'}happened
        </Text>
        <Text variant="body" tone="muted" style={styles.subtitle}>
          You are one of the first people running with Flint. What breaks for you
          gets fixed first.
        </Text>

        <SegmentedControl<FeedbackKind>
          value={kind}
          onChange={setKind}
          segments={[
            { value: 'bug', label: 'Something broke' },
            { value: 'idea', label: 'An idea' },
            { value: 'other', label: 'Other' },
          ]}
          style={styles.segment}
        />

        <Input
          label={kind === 'idea' ? 'Your idea' : 'What happened?'}
          placeholder={
            kind === 'bug'
              ? 'e.g. My run stopped recording at 3 km when the screen locked'
              : 'Tell us anything'
          }
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          containerStyle={styles.input}
        />

        <Text variant="caption" tone="muted" style={styles.meta}>
          Sent with: Flint {APP_VERSION} ({APP_BUILD}) · {deviceLabel()}
        </Text>

        {state === 'failed' ? (
          <Text variant="bodySm" tone="danger" style={styles.meta}>
            Could not send. Check your connection and try again.
          </Text>
        ) : null}

        <View style={styles.spacer} />
        <Button
          label={state === 'sending' ? 'Sending…' : 'Send'}
          size="lg"
          fullWidth
          disabled={message.trim().length === 0 || state === 'sending'}
          onPress={send}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  flex: { flex: 1 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8 },
  segment: { marginTop: 24 },
  input: { marginTop: 20 },
  meta: { marginTop: 10 },
  spacer: { flex: 1, minHeight: 24 },
  sentTitle: { marginTop: 16 },
  sentBody: { marginTop: 8, maxWidth: 300 },
  back: { marginTop: 24 },
});
