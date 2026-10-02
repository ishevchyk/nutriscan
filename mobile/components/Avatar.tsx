import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Radii, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';

type AvatarProps = {
  displayName?: string | null;
  email?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function initialsFor(displayName?: string | null, email?: string | null): string {
  if (displayName && displayName.trim()) {
    const words = displayName.trim().split(/\s+/).slice(0, 2);
    return words.map((w) => w[0]?.toUpperCase() ?? '').join('');
  }
  if (email && email.trim()) {
    return email.trim()[0]?.toUpperCase() ?? '?';
  }
  return '?';
}

export function Avatar({ displayName, email, size = 56, style }: AvatarProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);
  const initials = initialsFor(displayName, email);

  return (
    <View style={[styles.square, style]}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, size: number) {
  return StyleSheet.create({
    square: {
      width: size,
      height: size,
      borderRadius: Radii.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: size * 0.4,
      color: colors.onPrimary,
    },
  });
}
