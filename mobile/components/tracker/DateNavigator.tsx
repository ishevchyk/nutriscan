import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type DateNavigatorProps = {
  dateLabel: string;
  entryCount: number;
  onPrev: () => void;
  onNext: () => void;
  isCalendarOpen: boolean;
  onToggleCalendar: () => void;
};

export function DateNavigator({
  dateLabel,
  entryCount,
  onPrev,
  onNext,
  isCalendarOpen,
  onToggleCalendar,
}: DateNavigatorProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
      <View style={styles.card}>
        <Pressable style={styles.arrowButton} onPress={onPrev} hitSlop={8}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Pressable onPress={onToggleCalendar} hitSlop={8}>
          <View style={styles.center}>
            <View style={styles.titleRow}>
              <Text style={styles.dateLabel}>{dateLabel}</Text>
              <MaterialDesignIcons
                  name="calendar-month-outline"
                  size={16}
                  color={isCalendarOpen ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text style={styles.entryCount}>
              {entryCount} ENTR{entryCount === 1 ? 'Y' : 'IES'} LOGGED
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.arrowButton} onPress={onNext} hitSlop={8}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
    },
    arrowButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
    },
    arrowText: {
      fontSize: Typography.fontSize.lg,
      color: colors.text,
    },
    center: { alignItems: 'center', gap: 2 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    dateLabel: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    entryCount: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
  });
}
