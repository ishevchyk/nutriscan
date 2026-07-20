import { Platform } from 'react-native';

export const Typography = {
  fontFamily: {
    mono: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
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
