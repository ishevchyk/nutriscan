import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { Product, useProductStore, DELETED_RETENTION_DAYS } from '../store/productStore';
import { daysUntilPurge } from '../utils/formatUtils';
import { ProductCardBase } from '../components/products/ProductCardBase';

const URGENT_THRESHOLD_DAYS = 7;

export default function RecentlyDeletedScreen() {
  const { deletedProducts, deletedLoaded, loadDeletedProducts, restoreProduct } = useProductStore();
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadDeletedProducts().finally(() => setLoading(false));
  }, []);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await restoreProduct(id);
    } finally {
      setRestoringId(null);
    }
  }

  function renderItem({ item }: { item: Product }) {
    const remaining = item.deleted_at ? daysUntilPurge(item.deleted_at, DELETED_RETENTION_DAYS) : DELETED_RETENTION_DAYS;
    const urgent = remaining <= URGENT_THRESHOLD_DAYS;
    const isRestoring = restoringId === item.id;

    return (
      <ProductCardBase
        name={item.name}
        brand={item.brand}
        footer={
          <View style={styles.cardFooter}>
            <View style={styles.purgeStatus}>
              <View style={[styles.dot, { backgroundColor: urgent ? colors.error : colors.textTertiary }]} />
              <Text style={[styles.purgeLabel, urgent && styles.purgeLabelUrgent]}>
                {remaining}D UNTIL PURGE
              </Text>
            </View>
            <Pressable
              style={[styles.restoreButton, isRestoring && styles.restoreButtonDisabled]}
              onPress={() => handleRestore(item.id)}
              disabled={isRestoring}
            >
              <Text style={styles.restoreButtonText}>{isRestoring ? 'RESTORING…' : 'RESTORE'}</Text>
            </Pressable>
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.banner}>
          <View style={styles.bannerDot} />
          <Text style={styles.bannerText}>
            Deleted products are retained for <Text style={styles.bannerBold}>{DELETED_RETENTION_DAYS} days</Text>. Restore
            them any time before permanent purge.
          </Text>
        </View>

        {loading && <ActivityIndicator size="large" color={colors.primary} />}

        {deletedLoaded && (
          <Text style={styles.metaLabel}>
            {deletedProducts.length} {deletedProducts.length === 1 ? 'item' : 'items'} pending purge
          </Text>
        )}

        {deletedLoaded && deletedProducts.length === 0 && (
          <Text style={styles.placeholder}>Nothing here yet.</Text>
        )}

        <FlatList data={deletedProducts} keyExtractor={(item) => item.id} renderItem={renderItem} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: Spacing.xl },
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    bannerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 5,
    },
    bannerText: {
      flex: 1,
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    bannerBold: { fontFamily: Typography.fontFamily.monoBold, color: colors.text },
    metaLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
      marginBottom: Spacing.md,
    },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    purgeStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    purgeLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    purgeLabelUrgent: { color: colors.error },
    restoreButton: {
      backgroundColor: colors.primary,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    restoreButtonDisabled: { opacity: 0.6 },
    restoreButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.xs,
      fontWeight: Typography.fontWeight.semibold,
      letterSpacing: Typography.letterSpacing.label,
    },
  });
}
