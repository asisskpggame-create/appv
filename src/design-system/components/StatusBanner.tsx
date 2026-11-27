import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

interface StatusBannerProps {
  tone: BannerTone;
  title: string;
  description?: string;
}

const toneStyles: Record<BannerTone, string> = {
  info: 'border-[var(--asis-primary-border)] bg-[var(--asis-primary-soft)] text-[var(--asis-text-primary)]',
  success: 'border-[#2BB673]/35 bg-[#2BB673]/10 text-[var(--asis-text-primary)]',
  warning: 'border-[#E0A030]/40 bg-[#E0A030]/10 text-[var(--asis-text-primary)]',
  error: 'border-[#D64545]/40 bg-[#D64545]/10 text-[var(--asis-text-primary)]',
};

const iconColor: Record<BannerTone, string> = {
  info: 'text-[var(--asis-accent-fg)]',
  success: 'text-[#1E9E62] dark:text-[#3BC48A]',
  warning: 'text-[#B7791F] dark:text-[#E0A030]',
  error: 'text-[#C23939] dark:text-[#F07070]',
};

const icons: Record<BannerTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function StatusBanner({ tone, title, description }: StatusBannerProps) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-start ${toneStyles[tone]}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor[tone]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-6">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-[var(--asis-text-secondary)]">{description}</p>
        )}
      </div>
    </div>
  );
}
