import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyThemeToDocument,
  normalizeThemePalette,
  normalizeThemePreference,
} from './themeEngine';
import type {
  LocaleCode,
  TextDirection,
  ThemeMode,
  ThemePalette,
  ThemePreference,
} from './tokens';

const THEME_STORAGE_KEY = 'asis_theme_pref_v1';
const PALETTE_STORAGE_KEY = 'asis_palette_v1';
const LOCALE_STORAGE_KEY = 'asis_locale_pref_v1';

function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Ignore storage read errors
  }
  return 'dark';
}

function readStoredPalette(): ThemePalette {
  if (typeof window === 'undefined') return 'azure';
  try {
    return normalizeThemePalette(window.localStorage.getItem(PALETTE_STORAGE_KEY));
  } catch {
    // Ignore storage read errors
  }
  return 'azure';
}

function readStoredLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'en-US';
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'fa-IR' || raw === 'en-US') {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'en-US';
}

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface PreferencesContextValue {
  theme: ThemeMode;
  themePreference: ThemePreference;
  palette: ThemePalette;
  setTheme: (theme: ThemeMode) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleTheme: () => void;
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  dir: TextDirection;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    readStoredThemePreference,
  );
  const [palette, setPaletteState] = useState<ThemePalette>(readStoredPalette);
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(getSystemTheme);
  const [locale, setLocaleState] = useState<LocaleCode>(readStoredLocale);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme: ThemeMode = themePreference === 'system' ? systemTheme : themePreference;
  const dir: TextDirection = locale === 'fa-IR' ? 'rtl' : 'ltr';

  useEffect(() => {
    applyThemeToDocument(document.documentElement, theme, palette);
  }, [theme, palette]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
  }, [locale, dir]);

  const setThemePreference = (next: ThemePreference) => {
    setThemePreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  };

  const setTheme = (next: ThemeMode) => {
    setThemePreference(next);
  };

  const setPalette = (next: ThemePalette) => {
    setPaletteState(next);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  };

  const setLocale = (next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  };

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      themePreference,
      palette,
      setTheme,
      setThemePreference,
      setPalette,
      toggleTheme: () => setThemePreference(theme === 'light' ? 'dark' : 'light'),
      locale,
      setLocale,
      dir,
    }),
    [theme, themePreference, palette, locale, dir],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}
