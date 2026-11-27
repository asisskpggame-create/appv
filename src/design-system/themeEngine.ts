import type { ThemeMode, ThemePalette, ThemePreference } from './tokens';

export interface ThemeCssVariables {
  '--asis-bg': string;
  '--asis-chrome': string;
  '--asis-surface': string;
  '--asis-surface-2': string;
  '--asis-border': string;
  '--asis-border-strong': string;
  '--asis-text-primary': string;
  '--asis-text-secondary': string;
  '--asis-primary': string;
  '--asis-primary-hover': string;
  '--asis-primary-active': string;
  '--asis-primary-soft': string;
  '--asis-primary-border': string;
  '--asis-accent-fg': string;
  '--asis-glow-rgb': string;
  '--asis-skeleton-a': string;
  '--asis-skeleton-b': string;
  '--asis-chart-primary': string;
  '--asis-chart-secondary': string;
}

export interface PaletteMetadata {
  id: ThemePalette;
  nameEn: string;
  nameFa: string;
  shortEn: string;
  shortFa: string;
  subtitleEn: string;
  subtitleFa: string;
  swatchLight: string;
  swatchDark: string;
  secondarySwatchLight: string;
  secondarySwatchDark: string;
}

export const PALETTE_METADATA: Record<ThemePalette, PaletteMetadata> = {
  azure: {
    id: 'azure',
    nameEn: 'Azure',
    nameFa: 'آبی یاقوتی (Azure)',
    shortEn: 'Azure',
    shortFa: 'آبی',
    subtitleEn: 'Obsidian navy & cobalt',
    subtitleFa: 'سرمه‌ای ابسیدین و آبی کوبالت',
    swatchLight: '#087BFF',
    swatchDark: '#1D86FF',
    secondarySwatchLight: '#10B981',
    secondarySwatchDark: '#34D399',
  },
  emerald: {
    id: 'emerald',
    nameEn: 'Emerald',
    nameFa: 'زمردی (Emerald)',
    shortEn: 'Emerald',
    shortFa: 'زمردی',
    subtitleEn: 'Stealth forest & mint',
    subtitleFa: 'سبز تیره و زمردی',
    swatchLight: '#059669',
    swatchDark: '#10B981',
    secondarySwatchLight: '#087BFF',
    secondarySwatchDark: '#60A5FA',
  },
  titanium: {
    id: 'titanium',
    nameEn: 'Titanium',
    nameFa: 'تیتانیوم (Titanium)',
    shortEn: 'Titanium',
    shortFa: 'تیتانیوم',
    subtitleEn: 'Carbon slate & amber',
    subtitleFa: 'کربن خاکستری و کهربایی',
    swatchLight: '#D97706',
    swatchDark: '#F59E0B',
    secondarySwatchLight: '#10B981',
    secondarySwatchDark: '#34D399',
  },
  violet: {
    id: 'violet',
    nameEn: 'Violet',
    nameFa: 'بنفش (Violet)',
    shortEn: 'Violet',
    shortFa: 'بنفش',
    subtitleEn: 'Midnight plum & violet',
    subtitleFa: 'آلویی تیره و بنفش',
    swatchLight: '#7C3AED',
    swatchDark: '#8B5CF6',
    secondarySwatchLight: '#EC4899',
    secondarySwatchDark: '#F472B6',
  },
};

export const THEME_PALETTE_CSS_VARS: Record<ThemePalette, Record<ThemeMode, ThemeCssVariables>> = {
  azure: {
    light: {
      '--asis-bg': '#F4F6F9',
      '--asis-chrome': '#FFFFFF',
      '--asis-surface': '#FFFFFF',
      '--asis-surface-2': '#EEF1F5',
      '--asis-border': '#E2E7EE',
      '--asis-border-strong': '#CBD3DE',
      '--asis-text-primary': '#0F1722',
      '--asis-text-secondary': '#5B6778',
      '--asis-primary': '#2F6FEB',
      '--asis-primary-hover': '#4580F0',
      '--asis-primary-active': '#2560D0',
      '--asis-primary-soft': '#EBF1FE',
      '--asis-primary-border': '#C9D8FA',
      '--asis-accent-fg': '#1F5BD1',
      '--asis-glow-rgb': '47, 111, 235',
      '--asis-skeleton-a': '#E8ECF2',
      '--asis-skeleton-b': '#F4F6F9',
      '--asis-chart-primary': '#2F6FEB',
      '--asis-chart-secondary': '#22A06B',
    },
    dark: {
      '--asis-bg': '#0B0F15',
      '--asis-chrome': '#0F141C',
      '--asis-surface': '#141B24',
      '--asis-surface-2': '#1B2430',
      '--asis-border': '#232D3A',
      '--asis-border-strong': '#344154',
      '--asis-text-primary': '#EEF2F7',
      '--asis-text-secondary': '#8D9AAE',
      '--asis-primary': '#2F6FEB',
      '--asis-primary-hover': '#4580F0',
      '--asis-primary-active': '#2560D0',
      '--asis-primary-soft': '#14223D',
      '--asis-primary-border': '#25427C',
      '--asis-accent-fg': '#7AA7FF',
      '--asis-glow-rgb': '47, 111, 235',
      '--asis-skeleton-a': '#18212C',
      '--asis-skeleton-b': '#222E3C',
      '--asis-chart-primary': '#5B8FF5',
      '--asis-chart-secondary': '#3BC48A',
    },
  },
  emerald: {
    light: {
      '--asis-bg': '#F2F7F5',
      '--asis-chrome': '#F9FCFB',
      '--asis-surface': '#FFFFFF',
      '--asis-surface-2': '#E9F3EF',
      '--asis-border': '#D4E6DF',
      '--asis-border-strong': '#B6D4C9',
      '--asis-text-primary': '#0B1120',
      '--asis-text-secondary': '#4C665D',
      '--asis-primary': '#059669',
      '--asis-primary-hover': '#10B981',
      '--asis-primary-active': '#047857',
      '--asis-primary-soft': '#ECFDF5',
      '--asis-primary-border': '#A7F3D0',
      '--asis-accent-fg': '#047857',
      '--asis-glow-rgb': '5, 150, 105',
      '--asis-skeleton-a': '#E1F0EA',
      '--asis-skeleton-b': '#F1F9F5',
      '--asis-chart-primary': '#059669',
      '--asis-chart-secondary': '#087BFF',
    },
    dark: {
      '--asis-bg': '#040B09',
      '--asis-chrome': '#07120F',
      '--asis-surface': '#0B1B17',
      '--asis-surface-2': '#112620',
      '--asis-border': '#19362E',
      '--asis-border-strong': '#244D42',
      '--asis-text-primary': '#F1F7F4',
      '--asis-text-secondary': '#8EB2A6',
      '--asis-primary': '#10B981',
      '--asis-primary-hover': '#34D399',
      '--asis-primary-active': '#059669',
      '--asis-primary-soft': '#0C2920',
      '--asis-primary-border': '#1A4E3E',
      '--asis-accent-fg': '#34D399',
      '--asis-glow-rgb': '16, 185, 129',
      '--asis-skeleton-a': '#10241E',
      '--asis-skeleton-b': '#19382F',
      '--asis-chart-primary': '#34D399',
      '--asis-chart-secondary': '#60A5FA',
    },
  },
  titanium: {
    light: {
      '--asis-bg': '#F5F5F8',
      '--asis-chrome': '#FAFAFC',
      '--asis-surface': '#FFFFFF',
      '--asis-surface-2': '#ECECEF',
      '--asis-border': '#DFDFE6',
      '--asis-border-strong': '#C6C7D4',
      '--asis-text-primary': '#0F111A',
      '--asis-text-secondary': '#5A5D6E',
      '--asis-primary': '#D97706',
      '--asis-primary-hover': '#F59E0B',
      '--asis-primary-active': '#B45309',
      '--asis-primary-soft': '#FEF3C7',
      '--asis-primary-border': '#FDE68A',
      '--asis-accent-fg': '#B45309',
      '--asis-glow-rgb': '217, 119, 6',
      '--asis-skeleton-a': '#EAEAEF',
      '--asis-skeleton-b': '#F6F6FA',
      '--asis-chart-primary': '#D97706',
      '--asis-chart-secondary': '#10B981',
    },
    dark: {
      '--asis-bg': '#08090C',
      '--asis-chrome': '#0D0E14',
      '--asis-surface': '#13151E',
      '--asis-surface-2': '#1B1E2B',
      '--asis-border': '#25293A',
      '--asis-border-strong': '#363C54',
      '--asis-text-primary': '#F4F4F7',
      '--asis-text-secondary': '#9CA1B8',
      '--asis-primary': '#F59E0B',
      '--asis-primary-hover': '#FBBF24',
      '--asis-primary-active': '#D97706',
      '--asis-primary-soft': '#261C0A',
      '--asis-primary-border': '#573E14',
      '--asis-accent-fg': '#FBBF24',
      '--asis-glow-rgb': '245, 158, 11',
      '--asis-skeleton-a': '#181B26',
      '--asis-skeleton-b': '#242838',
      '--asis-chart-primary': '#FBBF24',
      '--asis-chart-secondary': '#34D399',
    },
  },
  violet: {
    light: {
      '--asis-bg': '#F6F4FB',
      '--asis-chrome': '#FFFFFF',
      '--asis-surface': '#FFFFFF',
      '--asis-surface-2': '#EFEBF8',
      '--asis-border': '#E4DEF2',
      '--asis-border-strong': '#CFC5E6',
      '--asis-text-primary': '#150F24',
      '--asis-text-secondary': '#62597A',
      '--asis-primary': '#7C3AED',
      '--asis-primary-hover': '#8B5CF6',
      '--asis-primary-active': '#6D28D9',
      '--asis-primary-soft': '#F1EAFE',
      '--asis-primary-border': '#D9C8FB',
      '--asis-accent-fg': '#6D28D9',
      '--asis-glow-rgb': '124, 58, 237',
      '--asis-skeleton-a': '#ECE7F6',
      '--asis-skeleton-b': '#F7F4FC',
      '--asis-chart-primary': '#7C3AED',
      '--asis-chart-secondary': '#EC4899',
    },
    dark: {
      '--asis-bg': '#0A0713',
      '--asis-chrome': '#0F0B1B',
      '--asis-surface': '#171028',
      '--asis-surface-2': '#20173A',
      '--asis-border': '#2C2146',
      '--asis-border-strong': '#40326A',
      '--asis-text-primary': '#F3F0FA',
      '--asis-text-secondary': '#A59BC0',
      '--asis-primary': '#8B5CF6',
      '--asis-primary-hover': '#A78BFA',
      '--asis-primary-active': '#7C3AED',
      '--asis-primary-soft': '#231747',
      '--asis-primary-border': '#4C348E',
      '--asis-accent-fg': '#B79CFF',
      '--asis-glow-rgb': '139, 92, 246',
      '--asis-skeleton-a': '#1C1432',
      '--asis-skeleton-b': '#291D49',
      '--asis-chart-primary': '#A78BFA',
      '--asis-chart-secondary': '#F472B6',
    },
  },
};

export function normalizeThemePreference(raw: unknown): ThemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'dark';
}

export function normalizeThemePalette(raw: unknown): ThemePalette {
  if (raw === 'azure' || raw === 'emerald' || raw === 'titanium' || raw === 'violet') {
    return raw;
  }
  return 'azure';
}

export function resolveThemeCssVariables(
  theme: ThemeMode,
  palette: ThemePalette,
): ThemeCssVariables {
  const safePalette = normalizeThemePalette(palette);
  return THEME_PALETTE_CSS_VARS[safePalette][theme];
}

export interface StyleTargetElement {
  classList: {
    add: (token: string) => void;
    remove: (token: string) => void;
  };
  setAttribute: (name: string, value: string) => void;
  style: {
    colorScheme: string;
    setProperty: (name: string, value: string) => void;
  };
}

export function applyThemeToDocument(
  root: StyleTargetElement,
  theme: ThemeMode,
  palette: ThemePalette,
): ThemeCssVariables {
  const safePalette = normalizeThemePalette(palette);
  const vars = resolveThemeCssVariables(theme, safePalette);

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-palette', safePalette);
  root.style.colorScheme = theme;

  for (const [token, value] of Object.entries(vars)) {
    root.style.setProperty(token, value);
  }

  return vars;
}
