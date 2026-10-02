import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function DeleteAccountScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete('/auth/me');
      useAuthStore.getState().clearTokens();
      router.replace('/(auth)/login');
    } catch {
      setError('Failed to delete your account. Try again.');
      setDeleting(false);
    }
  }

  function handleContinue() {
    Alert.alert(
      'Delete account?',
      "This can't be undone. All your products, meals, custom groups, goals, and log entries will be removed right away.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.segmentRow}>
        <View style={[styles.segment, styles.segmentActive]}>
          <Text style={styles.segmentActiveText}>Immediate</Text>
        </View>
        <View style={[styles.segment, styles.segmentDisabled]}>
          <Text style={styles.segmentDisabledText}>30-Day</Text>
          <Text style={styles.comingSoon}>Coming soon</Text>
        </View>
      </View>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>This permanently deletes your account</Text>
        <Text style={styles.warningBody}>
          Your products, meals, custom groups, goals and every log entry will be removed right away. This can't be
          undone.
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable style={[styles.continueButton, deleting && styles.continueButtonDisabled]} onPress={handleContinue} disabled={deleting}>
        {deleting ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.continueButtonText}>Continue</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} disabled={deleting}>
        <Text style={styles.keepText}>Keep my account</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing.xl },
    segmentRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    segment: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    segmentActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    segmentActiveText: {
      color: colors.text,
      fontWeight: Typography.fontWeight.semibold,
      fontSize: Typography.fontSize.base,
    },
    segmentDisabled: {
      borderColor: colors.border,
    },
    segmentDisabledText: {
      color: colors.textTertiary,
      fontSize: Typography.fontSize.base,
    },
    comingSoon: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textTertiary,
      marginTop: 2,
    },
    warningBox: {
      backgroundColor: colors.error + '1A',
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
      gap: Spacing.xs,
    },
    warningTitle: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.error,
    },
    warningBody: {
      fontSize: Typography.fontSize.sm,
      color: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: Typography.fontSize.sm,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    continueButton: {
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    continueButtonDisabled: { opacity: 0.6 },
    continueButtonText: {
      color: colors.error,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
    keepText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: Typography.fontSize.sm,
    },
  });
}
