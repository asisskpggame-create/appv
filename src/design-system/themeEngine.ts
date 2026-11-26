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
};

export const THEME_PALETTE_CSS_VARS: Record<ThemePalette, Record<ThemeMode, ThemeCssVariables>> = {
  azure: {
    light: {
      '--asis-bg': '#F3F6FB',
      '--asis-chrome': '#FAFBFD',
      '--asis-surface': '#FFFFFF',
      '--asis-surface-2': '#EDF2FA',
      '--asis-border': '#DCE5F2',
      '--asis-border-strong': '#C1D0E6',
      '--asis-text-primary': '#0B1120',
      '--asis-text-secondary': '#52627A',
      '--asis-primary': '#087BFF',
      '--asis-primary-hover': '#1684FF',
      '--asis-primary-active': '#0667D6',
      '--asis-primary-soft': '#EAF3FF',
      '--asis-primary-border': '#C5DCFF',
      '--asis-accent-fg': '#0564D4',
      '--asis-glow-rgb': '8, 123, 255',
      '--asis-skeleton-a': '#E6EEF9',
      '--asis-skeleton-b': '#F4F8FF',
      '--asis-chart-primary': '#087BFF',
      '--asis-chart-secondary': '#10B981',
    },
    dark: {
      '--asis-bg': '#050811',
      '--asis-chrome': '#080E1C',
      '--asis-surface': '#0D1527',
      '--asis-surface-2': '#131E36',
      '--asis-border': '#1B2844',
      '--asis-border-strong': '#2A3E66',
      '--asis-text-primary': '#F3F6FC',
      '--asis-text-secondary': '#94A8C7',
      '--asis-primary': '#1D86FF',
      '--asis-primary-hover': '#3B98FF',
      '--asis-primary-active': '#0F6FE0',
      '--asis-primary-soft': '#10213D',
      '--asis-primary-border': '#214073',
      '--asis-accent-fg': '#60A5FA',
      '--asis-glow-rgb': '29, 134, 255',
      '--asis-skeleton-a': '#131F39',
      '--asis-skeleton-b': '#1D2E54',
      '--asis-chart-primary': '#3898FF',
      '--asis-chart-secondary': '#34D399',
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
};

export function normalizeThemePreference(raw: unknown): ThemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'dark';
}

export function normalizeThemePalette(raw: unknown): ThemePalette {
  if (raw === 'azure' || raw === 'emerald' || raw === 'titanium') {
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
