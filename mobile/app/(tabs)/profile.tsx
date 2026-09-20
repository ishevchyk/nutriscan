import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useDebugStore } from '../../store/debugStore';

export default function ProfileScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const debugEnabled = useDebugStore((s) => s.debugEnabled);
  const setDebugEnabled = useDebugStore((s) => s.setDebugEnabled);

  return (
    <View style={styles.container}>
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
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, backgroundColor: colors.background },
    heading: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.lg, color: colors.text },
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
    },
    rowText: { flex: 1, gap: 4 },
    rowLabel: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium, color: colors.text },
    rowHint: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
  });
}
