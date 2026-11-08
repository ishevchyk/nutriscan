import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { adminErrorMessage, useAdminStore } from '../store/adminStore';
import { useGroupStore } from '../store/groupStore';

export default function AdminGroupsScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { systemGroups, loadSystemGroups, createSystemGroup, renameSystemGroup } = useAdminStore();

  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadSystemGroups()
      .catch(() => setError("Couldn't load groups."))
      .finally(() => setLoaded(true));
  }, []);

  // The regular group list is cached app-wide; refresh it so a new or renamed
  // system group shows up in pickers and filters without an app restart.
  async function run(action: () => Promise<void>, onSuccess: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSuccess();
      useGroupStore.getState().fetchGroups().catch(() => {});
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...systemGroups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>
        Built-in groups every user sees. They can be renamed but not deleted, so no user's products lose a group.
      </Text>

      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="New system group..."
          placeholderTextColor={colors.placeholder}
          value={newName}
          onChangeText={setNewName}
          maxLength={50}
        />
        <Pressable
          style={[styles.createButton, (!newName.trim() || busy) && styles.disabled]}
          disabled={!newName.trim() || busy}
          onPress={() => run(() => createSystemGroup(newName.trim()), () => setNewName(''))}
        >
          <Text style={styles.createButtonText}>Create</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loaded && <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />}

      {sorted.map((group) => (
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
              <Pressable
                disabled={busy || !editingName.trim()}
                onPress={() => run(() => renameSystemGroup(group.id, editingName.trim()), () => setEditingId(null))}
              >
                <Text style={styles.actionLink}>Save</Text>
              </Pressable>
              <Pressable onPress={() => setEditingId(null)}>
                <Text style={styles.actionLinkMuted}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <Pressable
                onPress={() => {
                  setEditingId(group.id);
                  setEditingName(group.name);
                  setError(null);
                }}
              >
                <Text style={styles.actionLink}>Rename</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  const mono = {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.xxs,
    textTransform: 'uppercase' as const,
    letterSpacing: Typography.letterSpacing.label,
  };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    caption: { fontSize: Typography.fontSize.sm, color: colors.textSecondary, marginBottom: Spacing.lg },
    createRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
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
    disabled: { opacity: 0.5 },
    createButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.sm,
      fontWeight: Typography.fontWeight.semibold,
      textTransform: 'uppercase',
    },
    errorText: { color: colors.error, fontSize: Typography.fontSize.sm, marginBottom: Spacing.sm },
    spinner: { marginVertical: Spacing.lg },
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
    actionLink: { ...mono, color: colors.primary },
    actionLinkMuted: { ...mono, color: colors.textSecondary },
  });
}
