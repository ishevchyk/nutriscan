import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import axios from 'axios';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useGroupStore } from '../store/groupStore';
import { Group } from '../store/types';
import { GroupChip } from '../components/groups/GroupChip';

function duplicateNameError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 409;
}

export default function GroupsScreen() {
  const { groups, loaded, fetchGroups, createGroup, renameGroup, deleteGroup } = useGroupStore();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      fetchGroups();
    }
  }, [loaded]);

  const customGroups = groups.filter((g) => !g.is_system);
  const systemGroups = groups.filter((g) => g.is_system);

  async function handleCreate() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createGroup(trimmed);
      setNewGroupName('');
    } catch (err) {
      setCreateError(duplicateNameError(err) ? 'A group with this name already exists.' : 'Something went wrong. Try again.');
    } finally {
      setCreating(false);
    }
  }

  function handleStartRename(group: Group) {
    setEditingId(group.id);
    setEditingName(group.name);
    setEditError(null);
  }

  function handleCancelRename() {
    setEditingId(null);
    setEditingName('');
    setEditError(null);
  }

  async function handleSaveRename(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await renameGroup(id, trimmed);
      setEditingId(null);
    } catch (err) {
      setEditError(duplicateNameError(err) ? 'A group with this name already exists.' : 'Something went wrong. Try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDelete(group: Group) {
    Alert.alert(
      `Delete "${group.name}"?`,
      'Products with this tag will no longer show it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteGroup(group.id) },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.metaLabel}>Custom groups</Text>
        <Text style={styles.countLabel}>{customGroups.length}</Text>
      </View>

      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="New group name..."
          placeholderTextColor={colors.placeholder}
          value={newGroupName}
          onChangeText={setNewGroupName}
          maxLength={50}
        />
        <Pressable
          style={[styles.createButton, (!newGroupName.trim() || creating) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!newGroupName.trim() || creating}
        >
          <Text style={styles.createButtonText}>{creating ? '...' : 'Create'}</Text>
        </Pressable>
      </View>
      {createError && <Text style={styles.errorText}>{createError}</Text>}

      {!loaded && <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />}

      {loaded && customGroups.length === 0 && <Text style={styles.placeholder}>No custom groups yet.</Text>}

      {customGroups.map((group) => (
        <View key={group.id} style={styles.groupRow}>
          {editingId === group.id ? (
            <>
              <TextInput
                style={styles.editInput}
                value={editingName}
                onChangeText={setEditingName}
                maxLength={50}
                autoFocus
              />
              <Pressable onPress={() => handleSaveRename(group.id)} disabled={savingEdit || !editingName.trim()}>
                <Text style={styles.actionLink}>{savingEdit ? '...' : 'Save'}</Text>
              </Pressable>
              <Pressable onPress={handleCancelRename}>
                <Text style={styles.actionLinkMuted}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <Pressable onPress={() => handleStartRename(group)}>
                <Text style={styles.actionLink}>Rename</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(group)}>
                <Text style={styles.actionLinkDanger}>Delete</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
      {editingId && editError && <Text style={styles.errorText}>{editError}</Text>}

      <Text style={[styles.metaLabel, styles.systemHeader]}>System groups</Text>
      <Text style={styles.systemCaption}>Built in — can be unassigned from products, but not deleted.</Text>
      <View style={styles.chipWrap}>
        {systemGroups.map((group) => (
          <GroupChip key={group.id} label={group.name} />
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    metaLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    countLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textTertiary,
    },
    createRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    input: {
      flex: 1,
      height: 44,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: Typography.fontSize.base,
    },
    createButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createButtonDisabled: { opacity: 0.5 },
    createButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.sm,
      fontWeight: Typography.fontWeight.semibold,
      textTransform: 'uppercase',
    },
    errorText: {
      color: colors.error,
      fontSize: Typography.fontSize.sm,
      marginBottom: Spacing.sm,
    },
    spinner: { marginVertical: Spacing.lg },
    placeholder: { color: colors.textSecondary, marginBottom: Spacing.md },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
    editInput: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontSize: Typography.fontSize.base,
      color: colors.text,
      paddingVertical: Spacing.xs,
    },
    actionLink: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    actionLinkMuted: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    actionLinkDanger: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.error,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    systemHeader: { marginTop: Spacing.xl, marginBottom: Spacing.xs },
    systemCaption: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
  });
}
