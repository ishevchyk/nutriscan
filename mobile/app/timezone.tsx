import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { COMMON_TIMEZONES, formatGmtOffset } from '../constants/timezones';
import { useSettingsStore } from '../store/settingsStore';
import { SectionLabel } from '../components/ui';

export default function TimezoneScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { settings, updateSettings } = useSettingsStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMON_TIMEZONES;
    return COMMON_TIMEZONES.filter(
      (tz) => tz.city.toLowerCase().includes(q) || tz.ianaId.toLowerCase().includes(q)
    );
  }, [query]);

  async function handleSelect(ianaId: string) {
    try {
      await updateSettings({ timezone: ianaId });
    } finally {
      router.back();
    }
  }

  function handleUseDevice() {
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    handleSelect(deviceTimezone);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>This defines where each day starts and ends in the Day tracker.</Text>

      <Pressable style={styles.deviceRow} onPress={handleUseDevice}>
        <MaterialDesignIcons name="crosshairs-gps" size={18} color={colors.primary} />
        <Text style={styles.deviceRowText}>Use device timezone</Text>
      </Pressable>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search city or timezone"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
      />

      <SectionLabel style={styles.listLabel}>Timezones</SectionLabel>

      {filtered.map((tz) => {
        const selected = tz.ianaId === settings?.timezone;
        return (
          <Pressable key={tz.ianaId} style={styles.row} onPress={() => handleSelect(tz.ianaId)}>
            <View style={styles.rowText}>
              <Text style={styles.city}>{tz.city}</Text>
              <Text style={styles.hint}>
                {tz.ianaId} · {formatGmtOffset(tz.ianaId)}
              </Text>
            </View>
            {selected && <MaterialDesignIcons name="check" size={20} color={colors.primary} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    subtitle: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: Spacing.lg,
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    deviceRowText: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.sm,
      color: colors.primary,
    },
    search: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: Typography.fontSize.base,
      color: colors.text,
      marginBottom: Spacing.xl,
    },
    listLabel: { marginBottom: Spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    rowText: { flex: 1, gap: 4 },
    city: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium, color: colors.text },
    hint: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
    },
  });
}
