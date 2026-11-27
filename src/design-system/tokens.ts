export const ASIS_BRAND_TOKENS = {
  colors: {
    primary: '#087BFF',
    secondary: '#EAF3FF',
    background: '#F3F6FB',
    surface: '#FFFFFF',
    primaryText: '#0B1120',
    secondaryText: '#52627A',
    accent: '#1684FF',
    border: '#DCE5F2',
    dark: {
      background: '#050811',
      chrome: '#080E1C',
      surface: '#0D1527',
      secondary: '#10213D',
      primaryText: '#F3F6FC',
      secondaryText: '#94A8C7',
      border: '#1B2844',
      accent: '#1D86FF',
    },
    semantic: {
      success: '#16A34A',
      warning: '#D97706',
      error: '#DC2626',
    },
  },
  palettes: {
    azure: {
      id: 'azure',
      swatchLight: '#087BFF',
      swatchDark: '#1D86FF',
    },
    emerald: {
      id: 'emerald',
      swatchLight: '#059669',
      swatchDark: '#10B981',
    },
    titanium: {
      id: 'titanium',
      swatchLight: '#D97706',
      swatchDark: '#F59E0B',
    },
    violet: {
      id: 'violet',
      swatchLight: '#7C3AED',
      swatchDark: '#8B5CF6',
    },
  },
  typography: {
    latinDisplay: 'Plus Jakarta Sans',
    persianDisplay: 'Vazirmatn',
    mono: 'JetBrains Mono',
  },
  radii: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
  },
} as const;

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemePalette = 'azure' | 'emerald' | 'titanium' | 'violet';
export type LocaleCode = 'en-US' | 'fa-IR';
export type TextDirection = 'ltr' | 'rtl';
