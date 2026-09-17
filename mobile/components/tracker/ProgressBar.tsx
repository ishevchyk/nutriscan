import { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Radii, ThemeColors } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type ProgressBarProps = {
  value: number;
  max: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({ value, max, color, trackColor, height = 8, style }: ProgressBarProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors, height), [colors, height]);
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <View style={[styles.track, trackColor ? { backgroundColor: trackColor } : null, style]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color ?? colors.primary }]} />
    </View>
  );
}

function createStyles(colors: ThemeColors, height: number) {
  return StyleSheet.create({
    track: {
      height,
      borderRadius: Radii.full,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: Radii.full,
    },
  });
}
