import {Link, useRouter} from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {authApi} from "../../lib/api";
import * as SecureStore from "expo-secure-store";
import {SECURE_STORE_REFRESH_KEY} from "../../constants/env";
import {Radii, Spacing, ThemeColors, Typography} from "../../constants/theme";
import {useThemeColor} from "../../hooks/useThemeColor";
import {useAuthStore} from "../../store/authStore";

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const router = useRouter();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleSignUp() {
    setError(null);
    setLoading(true);
    try {
      const { data } = await authApi.post<{ access_token: string; refresh_token: string }>(
          '/auth/register',
          { email, password }
      );
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, data.refresh_token);
      setTokens(data.access_token, data.refresh_token);
      router.replace('/(tabs)');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>NutriScan</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          Already have an account? Sign in
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
    title: { fontSize: Typography.fontSize.xxl, fontWeight: Typography.fontWeight.bold, textAlign: 'center', marginBottom: 4, color: colors.text },
    subtitle: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
      textTransform: 'uppercase',
      fontFamily: Typography.fontFamily.mono,
      letterSpacing: Typography.letterSpacing.label,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 0,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.onPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
    link: { textAlign: 'center', color: colors.primary, marginTop: 8 },
    error: { color: colors.error, fontSize: Typography.fontSize.sm, textAlign: 'center' },
  });
}
