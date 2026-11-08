import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAdminStore } from '../store/adminStore';
import { SectionLabel, StatGrid } from '../components/ui';

export default function AdminScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAdmin, stats, loadStats } = useAdminStore();
  const [error, setError] = useState(false);

  function Tile({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.tile}>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    );
  }

  useEffect(() => {
    if (!isAdmin) {
      router.back();
      return;
    }
    loadStats().catch(() => setError(true));
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionLabel style={styles.label}>Overview</SectionLabel>
      {!stats && !error && <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>Couldn't load stats.</Text>}
      {stats && (
        <StatGrid columns={2}>
          <Tile label="Users" value={String(stats.users_total)} />
          <Tile label="Admins" value={String(stats.admins)} />
          <Tile label="Disabled" value={String(stats.users_disabled)} />
          <Tile label="Signups 7d" value={String(stats.signups_last_7_days)} />
          <Tile label="Signups 30d" value={String(stats.signups_last_30_days)} />
          <Tile label="Log entries" value={String(stats.log_entries_total)} />
          <Tile label="Products" value={String(stats.products_total)} />
          <Tile label="Meals" value={String(stats.meals_total)} />
        </StatGrid>
      )}

      <SectionLabel style={[styles.label, styles.spaced]}>Manage</SectionLabel>
      <Pressable style={styles.row} onPress={() => router.push('/admin-users')}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Users</Text>
          <Text style={styles.rowHint}>Search, promote, disable</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push('/admin-groups')}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>System groups</Text>
          <Text style={styles.rowHint}>Create and rename built-in groups</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    label: { marginBottom: Spacing.md },
    spaced: { marginTop: Spacing.xl },
    spinner: { marginVertical: Spacing.lg },
    errorText: { color: colors.error, fontSize: Typography.fontSize.sm },
    tile: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: 2,
    },
    tileValue: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: colors.text },
    tileLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    rowText: { flex: 1, gap: 4 },
    rowLabel: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium, color: colors.text },
    rowHint: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
  });
}
