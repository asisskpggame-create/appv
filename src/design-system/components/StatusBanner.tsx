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
  success:
    'border-[#BBF7D0] bg-[#F0FDF4] text-[var(--asis-text-primary)] dark:border-[#14532D] dark:bg-[#072617]',
  warning:
    'border-[#FDE68A] bg-[#FFFBEB] text-[var(--asis-text-primary)] dark:border-[#78350F] dark:bg-[#2F1606]',
  error:
    'border-[#FECACA] bg-[#FEF2F2] text-[var(--asis-text-primary)] dark:border-[#7F1D1D] dark:bg-[#3A0C12]',
};

const iconColor: Record<BannerTone, string> = {
  info: 'text-[var(--asis-accent-fg)]',
  success: 'text-[#16A34A] dark:text-[#4ADE80]',
  warning: 'text-[#D97706] dark:text-[#FBBF24]',
  error: 'text-[#DC2626] dark:text-[#F87171]',
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
      className={`flex items-start gap-3 rounded-xl border p-4 text-start ${toneStyles[tone]}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor[tone]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-[var(--asis-text-secondary)]">{description}</p>
        )}
      </div>
    </div>
  );
}
