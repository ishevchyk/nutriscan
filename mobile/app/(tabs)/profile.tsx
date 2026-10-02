import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useDebugStore } from '../../store/debugStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useProfileStore } from '../../store/profileStore';
import { useGoalStore } from '../../store/goalStore';
import { useGroupStore } from '../../store/groupStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/Avatar';
import { activityLabel, sexLabel } from '../../constants/profileOptions';
import { cmToIn, kgToLb, round1 } from '../../utils/unitConversion';
import { SegmentedTabs } from '../../components/ui';

function formatDob(iso: string | null): string {
  if (!iso) return 'Not set';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

export default function ProfileScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deviceScheme = useColorScheme();
  const debugEnabled = useDebugStore((s) => s.debugEnabled);
  const setDebugEnabled = useDebugStore((s) => s.setDebugEnabled);

  const { settings, loaded: settingsLoaded, loadSettings, updateSettings } = useSettingsStore();
  const { profile, loaded: profileLoaded, loadProfile } = useProfileStore();
  const { goal, isSet: goalIsSet, loaded: goalLoaded, loadGoal } = useGoalStore();
  const { manageableGroups, hiddenGroupIds, hiddenLoaded, loadHiddenGroupsScreen } = useGroupStore();
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsLoaded) loadSettings();
    if (!profileLoaded) loadProfile();
    if (!goalLoaded) loadGoal();
    if (!hiddenLoaded) loadHiddenGroupsScreen();
  }, []);

  async function handleUpdateSettings(patch: Parameters<typeof updateSettings>[0]) {
    setSettingsError(null);
    try {
      await updateSettings(patch);
    } catch {
      setSettingsError('Failed to save. Try again.');
    }
  }

  async function handleLogout() {
    await useAuthStore.getState().logout();
    router.replace('/(auth)/login');
  }

  const units = settings?.units ?? 'metric';
  // Falls back to the device's own scheme for display until the user picks
  // a theme explicitly -- matches the ThemeOverrideProvider's own fallback.
  const theme = settings?.theme ?? (deviceScheme === 'dark' ? 'dark' : 'light');
  const height =
    profile?.height_cm != null
      ? `${units === 'imperial' ? round1(cmToIn(profile.height_cm)) : profile.height_cm} ${units === 'imperial' ? 'in' : 'cm'}`
      : 'Not set';
  const weight =
    profile?.weight_kg != null
      ? `${units === 'imperial' ? round1(kgToLb(profile.weight_kg)) : profile.weight_kg} ${units === 'imperial' ? 'lb' : 'kg'}`
      : 'Not set';

  const shownCount = hiddenLoaded ? manageableGroups.length - hiddenGroupIds.length : null;
  const hiddenCount = hiddenLoaded ? hiddenGroupIds.length : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.identityCard} onPress={() => router.push('/edit-profile')}>
        <Avatar displayName={profile?.display_name} email={profile?.email} />
        <View style={styles.identityText}>
          <Text style={styles.identityName} numberOfLines={1}>
            {profile?.display_name || profile?.email || 'Your profile'}
          </Text>
          {profile?.display_name && (
            <Text style={styles.identityEmail} numberOfLines={1}>
              {profile.email}
            </Text>
          )}
        </View>
        <MaterialDesignIcons name="chevron-right" size={22} color={colors.textSecondary} />
      </Pressable>

      <Text style={styles.sectionLabel}>Body stats</Text>
      <Pressable style={styles.statsCard} onPress={() => router.push('/edit-profile')}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Date of birth</Text>
          <Text style={styles.statValue}>{formatDob(profile?.date_of_birth ?? null)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Sex</Text>
          <Text style={styles.statValue}>{sexLabel(profile?.sex ?? null)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Height</Text>
          <Text style={styles.statValue}>{height}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Current weight</Text>
          <Text style={styles.statValue}>{weight}</Text>
        </View>
        <View style={[styles.statRow, styles.statRowLast]}>
          <Text style={styles.statLabel}>Activity</Text>
          <Text style={styles.statValue}>{activityLabel(profile?.activity_level ?? null)}</Text>
        </View>
      </Pressable>

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Daily goals</Text>
      <Pressable style={styles.goalsCard} onPress={() => router.push('/goals')}>
        <Text style={styles.goalsHeadline}>
          {goalIsSet && goal?.calories_goal != null ? `${goal.calories_goal} kcal` : 'Set your goals'}
        </Text>
        {goalIsSet && (
          <Text style={styles.goalsSubline}>
            P {goal?.protein_goal ?? 0}g · F {goal?.fat_goal ?? 0}g · C {goal?.carbs_goal ?? 0}g
          </Text>
        )}
      </Pressable>

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Preferences</Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Theme</Text>
          <Text style={styles.rowHint}>Defaults to your device's setting.</Text>
        </View>
        <SegmentedTabs
          tabs={[
            { key: 'light', label: 'Light' },
            { key: 'dark', label: 'Dark' },
          ]}
          active={theme}
          onChange={(next) => handleUpdateSettings({ theme: next })}
          style={styles.segmented}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Units</Text>
          <Text style={styles.rowHint}>Metric or imperial for display only.</Text>
        </View>
        <SegmentedTabs
          tabs={[
            { key: 'metric', label: 'Metric' },
            { key: 'imperial', label: 'Imperial' },
          ]}
          active={units}
          onChange={(next) => handleUpdateSettings({ units: next })}
          style={styles.segmented}
        />
      </View>

      <Pressable style={styles.row} onPress={() => router.push('/timezone')}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Timezone</Text>
          <Text style={styles.rowHint}>{settings?.timezone ?? 'UTC'}</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Text style={styles.rowHint}>Reminders coming soon</Text>
        </View>
        <Switch
          value={settings?.notifications_enabled ?? true}
          onValueChange={(notifications_enabled) => handleUpdateSettings({ notifications_enabled })}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.onPrimary}
        />
      </View>

      {settingsError && <Text style={styles.errorText}>{settingsError}</Text>}

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Product groups</Text>
      <Pressable style={styles.row} onPress={() => router.push('/hidden-groups')}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>System group visibility</Text>
          <Text style={styles.rowHint}>
            {shownCount != null ? `${shownCount} shown · ${hiddenCount} hidden` : 'Loading…'}
          </Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push('/groups')}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Manage custom groups</Text>
          <Text style={styles.rowHint}>In Product Library</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Account</Text>
      <Pressable style={styles.row} onPress={() => router.push('/change-password')}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Change password</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={styles.row} onPress={handleLogout}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Log out</Text>
        </View>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push('/delete-account')}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, styles.destructiveText]}>Delete account</Text>
          <Text style={styles.rowHint}>Permanently remove your account and data</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={20} color={colors.error} />
      </Pressable>

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Developer</Text>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Debug logging</Text>
          <Text style={styles.rowHint}>Logs API requests and store changes to the console.</Text>
        </View>
        <Switch
          value={debugEnabled}
          onValueChange={setDebugEnabled}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.onPrimary}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    sectionLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
      marginBottom: Spacing.md,
    },
    sectionSpacing: { marginTop: Spacing.xl },
    identityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    identityText: { flex: 1, gap: 2 },
    identityName: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semibold, color: colors.text },
    identityEmail: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
    statsCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.xl,
      paddingHorizontal: Spacing.lg,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statRowLast: { borderBottomWidth: 0 },
    statLabel: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
    statValue: { fontSize: Typography.fontSize.base, color: colors.text, fontWeight: Typography.fontWeight.medium },
    goalsCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: 4,
    },
    goalsHeadline: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: colors.text },
    goalsSubline: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: Spacing.lg,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    rowText: { flex: 1, gap: 4 },
    rowLabel: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium, color: colors.text },
    rowHint: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
    destructiveText: { color: colors.error },
    segmented: { width: 160 },
    errorText: {
      color: colors.error,
      fontSize: Typography.fontSize.sm,
      marginBottom: Spacing.sm,
    },
  });
}
