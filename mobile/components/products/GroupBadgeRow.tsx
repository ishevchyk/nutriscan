import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Group } from '../../store/types';

type GroupBadgeRowProps = {
  groups: Group[];
  maxVisible?: number;
};

export function GroupBadgeRow({ groups, maxVisible = 2 }: GroupBadgeRowProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (groups.length === 0) {
    return null;
  }

  const visible = groups.slice(0, maxVisible);
  const remaining = groups.length - visible.length;

  return (
    <View style={styles.row}>
      {visible.map((group) => (
        <View key={group.id} style={styles.badge}>
          <Text style={styles.badgeText} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
      ))}
      {remaining > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    badge: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.full,
      paddingVertical: 2,
      paddingHorizontal: Spacing.sm,
    },
    badgeText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
  });
}
