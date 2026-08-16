import React from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  /** Falls back to initials when omitted. */
  source?: ImageSourcePropType;
  /** Used to derive initials, and for accessibility. */
  name?: string;
  size?: AvatarSize;
  /** Draw an accent ring around the avatar. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DIAMETER: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 56 };

const initialsOf = (name?: string) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function Avatar({
  source,
  name,
  size = 'md',
  ring = false,
  style,
  testID,
}: AvatarProps) {
  const theme = useTheme();
  const d = DIAMETER[size];

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
      style={[
        styles.base,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: theme.colors.surfaceMuted,
        },
        ring ? [styles.ring, { borderColor: theme.colors.accent }] : null,
        style,
      ]}>
      {source ? (
        <Image
          source={source}
          style={{ width: d, height: d, borderRadius: d / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text variant={size === 'sm' ? 'label' : 'bodyStrong'}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { borderWidth: 2 },
});
