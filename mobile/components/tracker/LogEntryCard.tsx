import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { LogEntry } from '../../store/logStore';
import { Product } from '../../store/productStore';
import { computeEntryTotalGrams, formatSourceExtra } from '../../utils/logUtils';
import { formatAmount } from '../../utils/formatUtils';
import { EditableAmountStat } from './EditableAmountStat';
import { SourceBadge } from './SourceBadge';
import { SwipeableRow } from './SwipeableRow';

type LogEntryCardProps = {
  entry: LogEntry;
  product?: Product;
  mealName?: string;
  adjustedCount: number;
  isLast: boolean;
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

export function LogEntryCard({ entry, product, mealName, adjustedCount, isLast, onDelete, onUpdateAmount }: LogEntryCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [collapsed, setCollapsed] = useState(true);

  const name =
    entry.source_type === 'product'
      ? product?.name ?? 'Product'
      : entry.source_type === 'meal'
      ? mealName ?? 'Meal'
      : MANUAL_ENTRY_FALLBACK_NAME;

  const totalGrams = computeEntryTotalGrams(entry);

  return (
    <SwipeableRow onDelete={onDelete}>
      <View style={[styles.card, !isLast && styles.cardDivider]}>
        <View style={styles.cardIndicator} />
        <View style={styles.content}>
          <Pressable style={styles.headerRow} onPress={() => setCollapsed(!collapsed)}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.kcal}>{Math.round(entry.macros.calories)}<Text style={styles.metaText}>KCAL</Text></Text>
          </Pressable>

          {!collapsed && (
            <View>
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
                {totalGrams != null && (
                  <EditableAmountStat grams={totalGrams} onCommit={onUpdateAmount} />
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </SwipeableRow>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding: Spacing.md,
      gap: Spacing.sm,
      flexDirection: 'row',
      flex: 1,
      justifyContent: 'flex-start',
    },
    cardIndicator: {
      width: 2,
      alignSelf: 'stretch',
      backgroundColor: colors.primary,
    },
    content: {
      flex: 1,
    },
    cardDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    name: {
      flex: 1,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.medium,
      color: colors.text,
    },
    kcal: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginVertical: Spacing.sm,
    },
    metaText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
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
      alignItems: 'center',
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
