import React from 'react';
import { RefreshCw } from 'lucide-react';
import { getLatencyTier, type LatencyTier } from '../../features/servers/serverCatalogUtils';

export { getLatencyTier, type LatencyTier };

interface LatencyIndicatorProps {
  latencyMs: number | null;
  available: boolean | null;
  probing?: boolean;
  isFa?: boolean;
  compact?: boolean;
}

export function LatencyIndicator({
  latencyMs,
  available,
  probing = false,
  isFa = false,
  compact = false,
}: LatencyIndicatorProps) {
  if (probing) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--asis-accent-fg)] whitespace-nowrap">
        <RefreshCw className="h-3 w-3 animate-spin shrink-0" aria-hidden="true" />
        <span>{isFa ? 'در حال تست...' : 'Testing...'}</span>
      </span>
    );
  }

  const tier = getLatencyTier(latencyMs, available);

  const colorClass =
    tier === 'fast'
      ? 'text-[#16A34A] dark:text-[#4ADE80]'
      : tier === 'medium'
        ? 'text-[#D97706] dark:text-[#FBBF24]'
        : tier === 'slow' || tier === 'unreachable'
          ? 'text-[#DC2626] dark:text-[#F87171]'
          : 'text-[var(--asis-text-secondary)]';

  const activeBars =
    tier === 'fast' ? 3 : tier === 'medium' ? 2 : tier === 'slow' ? 1 : 0;

  const label =
    tier === 'unreachable'
      ? isFa
        ? 'عدم پاسخ'
        : 'Timeout'
      : latencyMs !== null
        ? `${latencyMs} ms`
        : compact
          ? '--'
          : isFa
            ? 'تست نشده'
            : 'Untested';

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-medium whitespace-nowrap ${colorClass}`}>
      <svg
        viewBox="0 0 14 12"
        className="h-3 w-3.5 shrink-0"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="7"
          width="3"
          height="4"
          rx="0.75"
          fill="currentColor"
          opacity={activeBars >= 1 ? 1 : 0.22}
        />
        <rect
          x="5.5"
          y="4"
          width="3"
          height="7"
          rx="0.75"
          fill="currentColor"
          opacity={activeBars >= 2 ? 1 : 0.22}
        />
        <rect
          x="10"
          y="1"
          width="3"
          height="10"
          rx="0.75"
          fill="currentColor"
          opacity={activeBars >= 3 ? 1 : 0.22}
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}
