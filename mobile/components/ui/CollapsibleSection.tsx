import { ReactNode, useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type CollapsibleSectionProps = {
  label: string;
  sublabel?: string;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  initiallyExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function CollapsibleSection({
  label,
  sublabel,
  expanded,
  onToggle,
  initiallyExpanded = false,
  style,
  children,
}: CollapsibleSectionProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [internalExpanded, setInternalExpanded] = useState(initiallyExpanded);
  const isExpanded = expanded ?? internalExpanded;

  function handleToggle() {
    const next = !isExpanded;
    setInternalExpanded(next);
    onToggle?.(next);
  }

  return (
    <View style={[styles.card, isExpanded && styles.cardExpanded, style]}>
      <Pressable style={styles.header} onPress={handleToggle}>
        <View style={styles.headerText}>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
        <Text style={styles.toggleText}>{isExpanded ? 'Hide' : 'Open'}</Text>
      </Pressable>
      {isExpanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
    },
    cardExpanded: {
      borderColor: colors.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    headerText: { flex: 1, gap: 2 },
    label: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    sublabel: {
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
    },
    toggleText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    body: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
  });
}
