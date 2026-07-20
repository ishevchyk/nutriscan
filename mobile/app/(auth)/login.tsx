import * as SecureStore from 'expo-secure-store';
import { Link, useRouter } from 'expo-router';
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

import { SECURE_STORE_REFRESH_KEY } from '../../constants/env';
import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const router = useRouter();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    console.log('Signing in with email:', email);
    try {
      const { data } = await authApi.post<{ access_token: string; refresh_token: string }>(
        '/auth/login',
        { email, password }
      );
      console.log('Login response:', data);
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, data.refresh_token);
      setTokens(data.access_token, data.refresh_token);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Login error:', err);
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
        <Text style={styles.subtitle}>Sign in to your account</Text>

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
          textContentType="password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
        </Pressable>

        <Link href="/(auth)/register" style={styles.link}>
          Don't have an account? Register
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
    error: { color: colors.error, fontSize: Typography.fontSize.sm, textAlign: 'center' },
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
  });
}
