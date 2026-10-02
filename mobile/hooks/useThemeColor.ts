import { useColorScheme } from 'react-native';

import { Colors, ThemeColors } from '../constants/Colors';
import { useThemeOverride } from '../contexts/ThemeOverrideContext';

export function useThemeColor(): ThemeColors {
  const scheme = useColorScheme();
  const override = useThemeOverride();
  const resolved = override ?? (scheme === 'dark' ? 'dark' : 'light');
  return Colors[resolved];
}
