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

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  /** Falls back to initials when omitted. */
  source?: ImageSourcePropType;
  /** Used to derive initials, and for accessibility. */
  name?: string;
  size?: AvatarSize;
  /** Draw an accent ring around the avatar. */
  ring?: boolean;
  /**
   * Rendered bottom-right, outside the clipped circle — e.g. an edit button.
   * Lives on the primitive so screens don't hand-roll absolute positioning.
   */
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DIAMETER: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 56, xl: 104 };

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
  badge,
  style,
  testID,
}: AvatarProps) {
  const theme = useTheme();
  const d = DIAMETER[size];

  const initialsVariant =
    size === 'xl' ? 'statMd' : size === 'sm' ? 'label' : 'bodyStrong';

  return (
    <View testID={testID} style={[{ width: d, height: d }, style]}>
      <View
        accessible
        accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
        style={[
          styles.circle,
          {
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: theme.colors.surfaceMuted,
          },
          ring ? [styles.ring, { borderColor: theme.colors.accent }] : null,
        ]}>
        {source ? (
          <Image
            source={source}
            style={{ width: d, height: d, borderRadius: d / 2 }}
            resizeMode="cover"
          />
        ) : (
          <Text variant={initialsVariant}>{initialsOf(name)}</Text>
        )}
      </View>

      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { borderWidth: 2 },
  badge: { position: 'absolute', right: -4, bottom: -4 },
});
