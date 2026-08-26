import { useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

export type SegmentedTab<K extends string> = { key: K; label: string };

type SegmentedTabsProps<K extends string> = {
  tabs: SegmentedTab<K>[];
  active: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedTabs<K extends string>({ tabs, active, onChange, style }: SegmentedTabsProps<K>) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.track, style]}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      padding: 2,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.sm,
      borderRadius: Radii.sm,
    },
    tabActive: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.text,
      fontFamily: Typography.fontFamily.monoMedium,
    },
  });
}
