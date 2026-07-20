export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  placeholder: string;
  error: string;
}

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: '#FAFAF8',
    surface: '#F1F0EC',
    border: '#E5E2DB',
    primary: '#C2703B',
    primaryPressed: '#A85F2E',
    onPrimary: '#FFFFFF',
    text: '#161311',
    textSecondary: '#6E6659',
    textTertiary: '#9B9284',
    placeholder: '#A79E8F',
    error: '#C1442D',
  },
  dark: {
    background: '#1B1714',
    surface: '#262019',
    border: '#3A332A',
    primary: '#D98A52',
    primaryPressed: '#C2703B',
    onPrimary: '#1B1714',
    text: '#F5F2EC',
    textSecondary: '#A69C8C',
    textTertiary: '#7D7466',
    placeholder: '#6E6558',
    error: '#E2694A',
  },
};

export type ColorScheme = keyof typeof Colors;
