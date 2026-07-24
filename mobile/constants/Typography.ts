import { Platform } from 'react-native';

export const Typography = {
  fontFamily: {
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
    monoBold: 'JetBrainsMono_700Bold',
    sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  },
  fontSize: {
    xs: 12,
    sm: 13,
    base: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    label: 1.2,
    wide: 2,
  },
} as const;
