import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useLogStore } from '../../store/logStore';
import { daysInMonth, firstWeekdayOfMonth, formatMonthLabel, getYearMonth, isToday, makeISODate } from '../../utils/dateUtils';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type CalendarViewProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export function CalendarView({ selectedDate, onSelectDate }: CalendarViewProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { loggedDays, loggedDaysKey, fetchLoggedDays } = useLogStore();

  const [{ year: viewYear, month: viewMonth }, setView] = useState(() => getYearMonth(selectedDate));

  useEffect(() => {
    fetchLoggedDays(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  function handlePrevMonth() {
    setView(viewMonth === 1 ? { year: viewYear - 1, month: 12 } : { year: viewYear, month: viewMonth - 1 });
  }

  function handleNextMonth() {
    setView(viewMonth === 12 ? { year: viewYear + 1, month: 1 } : { year: viewYear, month: viewMonth + 1 });
  }

  // loggedDays in the store still holds whichever month was last fetched -- only
  // treat it as this month's highlights once loggedDaysKey confirms it landed,
  // otherwise a month switch would flash the previous month's highlighted days.
  const viewKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
  const loggedSet = useMemo(
    () => (loggedDaysKey === viewKey ? new Set(loggedDays) : new Set<number>()),
    [loggedDays, loggedDaysKey, viewKey]
  );
  const totalDays = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = firstWeekdayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <View style={styles.card}>
      <View style={styles.monthHeader}>
        <Pressable style={styles.monthArrow} onPress={handlePrevMonth} hitSlop={8}>
          <Text style={styles.monthArrowText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(viewYear, viewMonth)}</Text>
        <Pressable style={styles.monthArrow} onPress={handleNextMonth} hitSlop={8}>
          <Text style={styles.monthArrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;

          const dateStr = makeISODate(viewYear, viewMonth, day);
          const hasData = loggedSet.has(day);
          const selected = dateStr === selectedDate;
          const today = isToday(dateStr);

          return (
            <Pressable key={dateStr} style={styles.cell} onPress={() => onSelectDate(dateStr)}>
              <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                <Text
                  style={[
                    styles.dayText,
                    !hasData && !selected && styles.dayTextMuted,
                    today && !selected && styles.dayTextToday,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    monthArrow: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthArrowText: {
      fontSize: Typography.fontSize.lg,
      color: colors.text,
    },
    monthLabel: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.textSecondary,
    },
    weekdayRow: {
      flexDirection: 'row',
    },
    weekdayLabel: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textTertiary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCircleSelected: {
      backgroundColor: colors.primary,
    },
    dayText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
    },
    dayTextMuted: {
      color: colors.textTertiary,
    },
    dayTextToday: {
      fontFamily: Typography.fontFamily.monoMedium,
      color: colors.primary,
    },
    dayTextSelected: {
      fontFamily: Typography.fontFamily.monoBold,
      color: colors.onPrimary,
    },
  });
}
