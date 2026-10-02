import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useGroupStore } from '../store/groupStore';

export default function HiddenGroupsScreen() {
  const { manageableGroups, hiddenGroupIds, hiddenLoaded, loadHiddenGroupsScreen, hideGroup, unhideGroup } =
    useGroupStore();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!hiddenLoaded) {
      loadHiddenGroupsScreen();
    }
  }, [hiddenLoaded]);

  function handleToggle(id: string, visible: boolean) {
    if (visible) {
      unhideGroup(id);
    } else {
      hideGroup(id);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Visibility affects only you</Text>
        <Text style={styles.bannerBody}>
          Hiding a group does not delete it or change any products. You can show it again any time.
        </Text>
      </View>

      {!hiddenLoaded && <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />}

      {hiddenLoaded &&
        manageableGroups.map((group) => {
          const visible = !hiddenGroupIds.includes(group.id);
          return (
            <View key={group.id} style={styles.groupRow}>
              <MaterialDesignIcons
                name={visible ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.textSecondary}
              />
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <Switch
                value={visible}
                onValueChange={(next) => handleToggle(group.id, next)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.onPrimary}
              />
            </View>
          );
        })}

      <Pressable style={styles.manageRow} onPress={() => router.push('/groups')}>
        <Text style={styles.manageLink}>Manage custom groups →</Text>
        <Text style={styles.manageHint}>Custom groups are managed in Product Library.</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    banner: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      gap: Spacing.xs,
    },
    bannerTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: colors.text },
    bannerBody: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
    spinner: { marginVertical: Spacing.lg },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    groupName: {
      flex: 1,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.medium,
      color: colors.text,
    },
    manageRow: { alignItems: 'center', marginTop: Spacing.xl, gap: 4 },
    manageLink: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    manageHint: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
  });
}
