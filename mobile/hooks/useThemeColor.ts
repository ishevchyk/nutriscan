import { useColorScheme } from 'react-native';

import { Colors, ThemeColors } from '../constants/Colors';

export function useThemeColor(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
