import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { usePreferences } from '../ThemeContext';
import { PALETTE_METADATA } from '../themeEngine';
import type { ThemePalette, ThemePreference } from '../tokens';
import { SegmentedControl } from './SegmentedControl';

interface ThemePaletteSwitcherProps {
  variant?: 'popover' | 'panel';
}

const PALETTE_ORDER: ThemePalette[] = ['azure', 'emerald', 'titanium'];

export function ThemePaletteSwitcher({ variant = 'popover' }: ThemePaletteSwitcherProps) {
  const { theme, themePreference, setThemePreference, palette, setPalette, locale } =
    usePreferences();
  const isFa = locale === 'fa-IR';
  const isDark = theme === 'dark';

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const activeMeta = PALETTE_METADATA[palette];
  const activeSwatch = isDark ? activeMeta.swatchDark : activeMeta.swatchLight;

  if (variant === 'panel') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-[var(--asis-accent-fg)]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--asis-text-primary)]">
              {isFa ? 'ظاهر و پالت رنگی برنامه' : 'Theme & Color Palette'}
            </p>
          </div>

          <SegmentedControl<ThemePreference>
            ariaLabel={isFa ? 'حالت نمایش' : 'Appearance mode'}
            value={themePreference}
            onChange={setThemePreference}
            options={[
              { value: 'dark', label: isFa ? 'تاریک' : 'Dark' },
              { value: 'light', label: isFa ? 'روشن' : 'Light' },
              { value: 'system', label: isFa ? 'سیستم' : 'System' },
            ]}
          />
        </div>

        <div
          role="radiogroup"
          aria-label={isFa ? 'انتخاب پالت رنگ' : 'Select color palette'}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {PALETTE_ORDER.map((id) => {
            const meta = PALETTE_METADATA[id];
            const selected = palette === id;
            const primaryColor = isDark ? meta.swatchDark : meta.swatchLight;
            const secondaryColor = isDark
              ? meta.secondarySwatchDark
              : meta.secondarySwatchLight;

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPalette(id)}
                className={`group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start transition-all duration-150 cursor-pointer ${
                  selected
                    ? 'border-[var(--asis-primary-border)] bg-[var(--asis-primary-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-[var(--asis-border)] bg-[var(--asis-surface-2)]/50 hover:border-[var(--asis-border-strong)] hover:bg-[var(--asis-surface-2)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--asis-border)] bg-[var(--asis-surface)]">
                    <span
                      className="h-3.5 w-3.5 rounded-full transition-transform duration-150 group-hover:scale-110"
                      style={{ backgroundColor: primaryColor }}
                      aria-hidden="true"
                    />
                    <span
                      className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border border-[var(--asis-surface)]"
                      style={{ backgroundColor: secondaryColor }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        selected
                          ? 'text-[var(--asis-accent-fg)]'
                          : 'text-[var(--asis-text-primary)]'
                      }`}
                    >
                      {isFa ? meta.nameFa : meta.nameEn}
                    </p>
                    <p className="text-[11px] text-[var(--asis-text-secondary)] truncate">
                      {isFa ? meta.subtitleFa : meta.subtitleEn}
                    </p>
                  </div>
                </div>

                {selected && (
                  <Check
                    className="h-4 w-4 shrink-0 text-[var(--asis-accent-fg)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          isFa
            ? `تغییر تم و پالت رنگ (${activeMeta.shortFa})`
            : `Switch theme and palette (${activeMeta.shortEn})`
        }
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 items-center gap-2 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-2.5 text-xs font-medium text-[var(--asis-text-primary)] transition-all duration-150 hover:border-[var(--asis-border-strong)] hover:bg-[var(--asis-surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)] cursor-pointer whitespace-nowrap shrink-0"
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: activeSwatch }}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">{isFa ? activeMeta.shortFa : activeMeta.shortEn}</span>
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-[var(--asis-text-secondary)]" aria-hidden="true" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-[var(--asis-text-secondary)]" aria-hidden="true" />
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[var(--asis-text-secondary)] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={isFa ? 'تنظیم سریع ظاهر و پالت رنگ' : 'Theme and palette switcher'}
          className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[var(--asis-border)] bg-[var(--asis-surface)] p-3.5 text-start shadow-xl"
        >
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-[11px] font-semibold text-[var(--asis-text-secondary)]">
                {isFa ? 'حالت نمایش' : 'Theme Mode'}
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface-2)] p-1">
                {(
                  [
                    { value: 'dark', label: isFa ? 'تاریک' : 'Dark', icon: Moon },
                    { value: 'light', label: isFa ? 'روشن' : 'Light', icon: Sun },
                    { value: 'system', label: isFa ? 'سیستم' : 'Auto', icon: Monitor },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = themePreference === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setThemePreference(opt.value)}
                      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[var(--asis-surface)] text-[var(--asis-accent-fg)] shadow-xs font-semibold'
                          : 'text-[var(--asis-text-secondary)] hover:text-[var(--asis-text-primary)]'
                      }`}
                    >
                      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--asis-border)] pt-3">
              <p className="mb-2 text-[11px] font-semibold text-[var(--asis-text-secondary)]">
                {isFa ? 'پالت رنگی' : 'Color Palette'}
              </p>
              <div className="space-y-1.5">
                {PALETTE_ORDER.map((id) => {
                  const meta = PALETTE_METADATA[id];
                  const selected = palette === id;
                  const swatch = isDark ? meta.swatchDark : meta.swatchLight;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setPalette(id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-start transition-all duration-150 cursor-pointer ${
                        selected
                          ? 'border-[var(--asis-primary-border)] bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]'
                          : 'border-transparent text-[var(--asis-text-primary)] hover:bg-[var(--asis-surface-2)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
                          style={{ backgroundColor: swatch }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold truncate">
                            {isFa ? meta.nameFa : meta.nameEn}
                          </span>
                          <span className="block text-[10px] text-[var(--asis-text-secondary)] truncate">
                            {isFa ? meta.subtitleFa : meta.subtitleEn}
                          </span>
                        </div>
                      </div>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
