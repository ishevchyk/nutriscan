import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function SettingsScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.placeholder}>Settings will appear here.</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, backgroundColor: colors.background },
    heading: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.lg, color: colors.text },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
