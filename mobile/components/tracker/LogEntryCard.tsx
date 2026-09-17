import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { LogEntry } from '../../store/logStore';
import { Product } from '../../store/productStore';
import { computeEntryTotalGrams, formatSourceExtra } from '../../utils/logUtils';
import { formatAmount } from '../../utils/formatUtils';
import { EditableAmountStat } from './EditableAmountStat';
import { SourceBadge } from './SourceBadge';

type LogEntryCardProps = {
  entry: LogEntry;
  product?: Product;
  mealName?: string;
  adjustedCount: number;
  onDelete: () => void;
  onUpdateAmount: (grams: number) => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Backend has no name/label field for manual entries -- flagged as a
// contract gap to raise separately, not something to patch client-side.
const MANUAL_ENTRY_FALLBACK_NAME = 'Manual entry';

export function LogEntryCard({ entry, product, mealName, adjustedCount, onDelete, onUpdateAmount }: LogEntryCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const name =
    entry.source_type === 'product'
      ? product?.name ?? 'Product'
      : entry.source_type === 'meal'
      ? mealName ?? 'Meal'
      : MANUAL_ENTRY_FALLBACK_NAME;

  const totalGrams = computeEntryTotalGrams(entry);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.kcal}>{Math.round(entry.macros.calories)}<Text style={styles.metaText}>KCAL</Text></Text>
        <Pressable style={styles.deleteButton} onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{formatTime(entry.logged_at)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <SourceBadge source={entry.source_type} />
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{formatSourceExtra(entry, product)}</Text>
        {adjustedCount > 0 && (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.adjustedTag}>
              {adjustedCount} INGREDIENT{adjustedCount === 1 ? '' : 'S'} ADJUSTED
            </Text>
          </>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          {totalGrams != null ? (
            <EditableAmountStat grams={totalGrams} onCommit={onUpdateAmount} />
          ) : (
            <>
              <Text style={styles.statValue}>{formatAmount(entry.macros.calories)}</Text>
              <Text style={styles.statLabel}>kcal</Text>
            </>
          )}
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(entry.macros.protein)}g</Text>
          <Text style={styles.statLabel}>protein</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(entry.macros.fat)}g</Text>
          <Text style={styles.statLabel}>fat</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(entry.macros.carbs)}g</Text>
          <Text style={styles.statLabel}>carbs</Text>
        </View>
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
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    name: {
      flex: 1,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    deleteButton: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
    },
    deleteText: { color: colors.textSecondary, fontSize: Typography.fontSize.base, lineHeight: Typography.fontSize.base },
    kcal: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.lg,
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    metaText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    metaDot: { color: colors.textTertiary, fontSize: Typography.fontSize.xxs },
    adjustedTag: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.primary,
    },
    statsRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.sm,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
    },
    statLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
  });
}
