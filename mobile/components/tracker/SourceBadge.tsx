import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { SourceType } from '../../store/logStore';

type SourceBadgeProps = {
  source: SourceType;
};

// Display labels differ from the API's source_type strings on purpose --
// "product" reads as "LIBRARY" to match how the Product Library is named
// elsewhere in the app. "meal" reads as "MEAL", never "RECIPE" (naming
// decision in README.md #2 -- Recipe was fully renamed to Meal).
const SOURCE_BADGE_LABEL: Record<SourceType, string> = {
  product: 'LIBRARY',
  meal: 'MEAL',
  manual: 'MANUAL',
};

export function SourceBadge({ source }: SourceBadgeProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{SOURCE_BADGE_LABEL[source]}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.full,
      paddingVertical: 1,
      paddingHorizontal: Spacing.sm,
    },
    text: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
  });
}
