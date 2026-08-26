import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type LinkBadgeProps = {
  linked: boolean;
};

export function LinkBadge({ linked }: LinkBadgeProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors, linked), [colors, linked]);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{linked ? '✓ In Library' : '• Not saved'}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors, linked: boolean) {
  return StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: linked ? colors.surface : colors.surface,
      borderWidth: 1,
      borderColor: linked ? colors.primary : colors.border,
      borderRadius: Radii.full,
      paddingVertical: 2,
      paddingHorizontal: Spacing.sm,
    },
    text: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: linked ? colors.primary : colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
  });
}
