import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  /** Shown under the field in the danger tone; also turns the border red. */
  error?: string;
  /** Shown under the field when there is no error. */
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Render on a dark card. */
  onDark?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({
  label,
  error,
  hint,
  iconLeft,
  iconRight,
  onDark = false,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
    ? theme.colors.accent
    : onDark
    ? theme.colors.borderInverse
    : theme.colors.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          variant="label"
          tone={onDark ? 'inverseMuted' : 'muted'}
          uppercase
          style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor: onDark
              ? theme.colors.surfaceInverseMuted
              : theme.colors.surface,
            borderColor,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.base,
            columnGap: theme.spacing.sm,
          },
        ]}>
        {iconLeft}
        <TextInput
          {...rest}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholderTextColor={
            onDark ? theme.colors.textInverseMuted : theme.colors.textMuted
          }
          style={[
            styles.input,
            theme.typography.body,
            { color: onDark ? theme.colors.textInverse : theme.colors.text },
          ]}
        />
        {iconRight}
      </View>

      {error || hint ? (
        <Text
          variant="caption"
          tone={error ? 'danger' : onDark ? 'inverseMuted' : 'muted'}
          style={styles.helper}>
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    height: 52,
  },
  input: { flex: 1, padding: 0 },
  helper: { marginTop: 6 },
});
