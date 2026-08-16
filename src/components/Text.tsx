import React from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useTheme, type TypographyVariant } from '../theme';

/**
 * Which semantic colour the text should take. Keeping this as a named set
 * (rather than a raw `color` prop) is what keeps one-off hex out of screens.
 */
export type TextTone =
  | 'default'
  | 'muted'
  | 'inverse'
  | 'inverseMuted'
  | 'accent'
  | 'onAccent'
  /** For text on an always-light `bright` surface. */
  | 'onBright'
  | 'success'
  | 'danger';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  /** Force uppercase — used by the small labels under stat numbers. */
  uppercase?: boolean;
};

export function Text({
  variant = 'body',
  tone = 'default',
  align,
  uppercase = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    inverse: theme.colors.textInverse,
    inverseMuted: theme.colors.textInverseMuted,
    accent: theme.colors.accent,
    onAccent: theme.colors.onAccent,
    onBright: theme.colors.textOnBright,
    success: theme.colors.success,
    danger: theme.colors.danger,
  };

  return (
    <RNText
      {...rest}
      style={StyleSheet.flatten([
        theme.typography[variant] as TextStyle,
        { color: toneColor[tone] },
        align ? { textAlign: align } : null,
        uppercase ? styles.uppercase : null,
        style,
      ])}
    />
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
});
