import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { Product, useProductStore, DELETED_RETENTION_DAYS } from '../store/productStore';
import { RecipeSummary, useRecipeStore } from '../store/recipeStore';
import { daysUntilPurge } from '../utils/formatUtils';
import { ProductCardBase } from '../components/products/ProductCardBase';

const URGENT_THRESHOLD_DAYS = 7;

export default function RecentlyDeletedScreen() {
  const { deletedProducts, deletedLoaded, loadDeletedProducts, restoreProduct } = useProductStore();
  const { deletedRecipes, deletedLoaded: deletedRecipesLoaded, loadDeletedRecipes, restoreRecipe } = useRecipeStore();
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    Promise.all([loadDeletedProducts(), loadDeletedRecipes()]).finally(() => setLoading(false));
  }, []);

  async function handleRestoreProduct(id: string) {
    setRestoringId(id);
    try {
      await restoreProduct(id);
    } finally {
      setRestoringId(null);
    }
  }

  async function handleRestoreRecipe(id: string) {
    setRestoringId(id);
    try {
      await restoreRecipe(id);
    } finally {
      setRestoringId(null);
    }
  }

  function renderProduct(item: Product) {
    const remaining = item.deleted_at ? daysUntilPurge(item.deleted_at, DELETED_RETENTION_DAYS) : DELETED_RETENTION_DAYS;
    const urgent = remaining <= URGENT_THRESHOLD_DAYS;
    const isRestoring = restoringId === item.id;

    return (
      <ProductCardBase
        key={item.id}
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
              onPress={() => handleRestoreProduct(item.id)}
              disabled={isRestoring}
            >
              <Text style={styles.restoreButtonText}>{isRestoring ? 'RESTORING…' : 'RESTORE'}</Text>
            </Pressable>
          </View>
        }
      />
    );
  }

  function renderRecipe(item: RecipeSummary) {
    const isRestoring = restoringId === item.id;

    return (
      <ProductCardBase
        key={item.id}
        name={item.name}
        footer={
          <View style={styles.cardFooter}>
            <Text style={styles.purgeLabel}>UPDATED {new Date(item.updated_at).toLocaleDateString()}</Text>
            <Pressable
              style={[styles.restoreButton, isRestoring && styles.restoreButtonDisabled]}
              onPress={() => handleRestoreRecipe(item.id)}
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
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.banner}>
          <View style={styles.bannerDot} />
          <Text style={styles.bannerText}>
            Deleted products are retained for <Text style={styles.bannerBold}>{DELETED_RETENTION_DAYS} days</Text>. Restore
            them any time before permanent purge. Recipe portions delete instantly and cannot be restored.
          </Text>
        </View>

        {loading && <ActivityIndicator size="large" color={colors.primary} />}

        {deletedLoaded && (
          <>
            <Text style={styles.sectionHeader}>Products</Text>
            {deletedProducts.length === 0 ? (
              <Text style={styles.placeholder}>Nothing here yet.</Text>
            ) : (
              deletedProducts.map(renderProduct)
            )}
          </>
        )}

        {deletedRecipesLoaded && (
          <>
            <Text style={[styles.sectionHeader, styles.sectionSpacing]}>Recipes</Text>
            {deletedRecipes.length === 0 ? (
              <Text style={styles.placeholder}>Nothing here yet.</Text>
            ) : (
              deletedRecipes.map(renderRecipe)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    contentInner: { padding: Spacing.xl },
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
    sectionHeader: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
      marginBottom: Spacing.md,
    },
    sectionSpacing: { marginTop: Spacing.xl },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 20, marginBottom: Spacing.md },
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
