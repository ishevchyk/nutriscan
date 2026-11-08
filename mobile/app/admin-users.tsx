import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { AdminUser, adminErrorMessage, useAdminStore } from '../store/adminStore';
import { useAuthStore } from '../store/authStore';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export default function AdminUsersScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { searchUsers, updateUser, deleteUser } = useAdminStore();
  const myId = useAuthStore((s) => s.userId);

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 400);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [typedEmail, setTypedEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchUsers(debounced)
      .then((res) => {
        if (cancelled) return;
        setUsers(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch(() => !cancelled && setError("Couldn't load users."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  function confirmChange(user: AdminUser, title: string, message: string, patch: Parameters<typeof updateUser>[1]) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          setBusyId(user.id);
          setError(null);
          try {
            const updated = await updateUser(user.id, patch);
            setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
          } catch (err) {
            setError(adminErrorMessage(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    setBusyId(target.id);
    setError(null);
    setDeleting(null);
    try {
      await deleteUser(target.id);
      setUsers((list) => list.filter((u) => u.id !== target.id));
      setTotal((n) => n - 1);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.search}
        placeholder="Search by email..."
        placeholderTextColor={colors.placeholder}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.count}>{loading ? 'Loading…' : `${total} user${total === 1 ? '' : 's'}`}</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {loading && users.length === 0 && <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />}

      {users.map((user) => {
        const isSelf = user.id === myId;
        const disabled = user.disabled_at != null;
        const busy = busyId === user.id;
        return (
          <View key={user.id} style={[styles.card, disabled && styles.cardDisabled]}>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
              {isSelf ? ' (you)' : ''}
            </Text>
            <Text style={styles.meta}>
              {user.role === 'admin' ? 'Admin' : 'User'} · joined {formatDate(user.created_at)} ·{' '}
              {user.sign_in_methods.join(', ')}
              {disabled ? ' · DISABLED' : ''}
            </Text>
            {!isSelf && (
              <View style={styles.actions}>
                {busy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Pressable
                      onPress={() =>
                        user.role === 'admin'
                          ? confirmChange(user, 'Remove admin?', `${user.email} will lose admin access.`, { role: 'user' })
                          : confirmChange(user, 'Make admin?', `${user.email} will get full admin access.`, { role: 'admin' })
                      }
                    >
                      <Text style={styles.actionLink}>{user.role === 'admin' ? 'Remove admin' : 'Make admin'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        disabled
                          ? confirmChange(user, 'Enable account?', `${user.email} will be able to sign in again.`, { disabled: false })
                          : confirmChange(user, 'Disable account?', `${user.email} will be signed out and blocked. Their data is kept.`, { disabled: true })
                      }
                    >
                      <Text style={disabled ? styles.actionLink : styles.actionLinkDanger}>
                        {disabled ? 'Enable' : 'Disable'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setTypedEmail('');
                        setDeleting(user);
                      }}
                    >
                      <Text style={styles.actionLinkDanger}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      {deleting && (
        <View style={styles.deletePanel}>
          <Text style={styles.deleteTitle}>Delete {deleting.email}?</Text>
          <Text style={styles.meta}>
            This permanently removes the account and all of its products, meals, groups and log entries. It cannot be
            undone. Type the email to confirm.
            {deleting.role === 'admin' ? ' Remove admin access first.' : ''}
          </Text>
          <TextInput
            style={styles.search}
            value={typedEmail}
            onChangeText={setTypedEmail}
            placeholder={deleting.email}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.actions}>
            <Pressable
              disabled={typedEmail.trim().toLowerCase() !== deleting.email.toLowerCase()}
              onPress={handleDelete}
              style={typedEmail.trim().toLowerCase() !== deleting.email.toLowerCase() && styles.disabled}
            >
              <Text style={styles.actionLinkDanger}>Delete forever</Text>
            </Pressable>
            <Pressable onPress={() => setDeleting(null)}>
              <Text style={styles.actionLink}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
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
    search: {
      height: 44,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: Typography.fontSize.base,
    },
    count: { ...mono, color: colors.textSecondary, marginVertical: Spacing.md },
    errorText: { color: colors.error, fontSize: Typography.fontSize.sm, marginBottom: Spacing.sm },
    spinner: { marginVertical: Spacing.lg },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: 4,
      marginBottom: Spacing.sm,
    },
    cardDisabled: { opacity: 0.6 },
    email: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium, color: colors.text },
    meta: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
    actions: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.sm },
    disabled: { opacity: 0.4 },
    deletePanel: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    deleteTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: colors.error },
    actionLink: { ...mono, color: colors.primary },
    actionLinkDanger: { ...mono, color: colors.error },
  });
}
