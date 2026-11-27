import React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`asis-skeleton rounded-md ${className}`} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface-2)]/70 px-4 py-3"
        >
          <div className="space-y-2 flex-1">
            <SkeletonBlock className="h-3.5 w-2/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
          <SkeletonBlock className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function ServerCatalogSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card padding="none" className="overflow-x-auto">
      <div role="status" aria-busy="true" aria-label="Loading server locations">
        <table className="w-full text-start text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--asis-border)]">
              <th className="px-4 py-3 text-start">
                <SkeletonBlock className="h-3 w-24" />
              </th>
              <th className="px-4 py-3 text-start">
                <SkeletonBlock className="h-3 w-16" />
              </th>
              <th className="px-4 py-3 text-start">
                <SkeletonBlock className="h-3 w-16" />
              </th>
              <th className="px-4 py-3 text-end">
                <SkeletonBlock className="ms-auto h-3 w-20" />
              </th>
              <th className="px-4 py-3 text-end">
                <SkeletonBlock className="ms-auto h-3 w-12" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--asis-border)]">
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={index}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <SkeletonBlock className="h-4 w-4 rounded-sm shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <SkeletonBlock className="h-4 w-40" />
                      <SkeletonBlock className="h-3 w-28" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SkeletonBlock className="h-3.5 w-5 rounded-[3px] shrink-0" />
                    <SkeletonBlock className="h-3.5 w-20" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SkeletonBlock className="h-3.5 w-16" />
                </td>
                <td className="px-4 py-3">
                  <SkeletonBlock className="ms-auto h-3.5 w-14" />
                </td>
                <td className="px-4 py-3 text-end">
                  <SkeletonBlock className="ms-auto h-9 w-20 rounded-xl" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function SubscriptionListSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading subscriptions">
      {Array.from({ length: cards }).map((_, index) => (
        <Card key={index} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--asis-border)] pb-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-9 w-24 rounded-xl" />
              <SkeletonBlock className="h-9 w-20 rounded-xl" />
              <SkeletonBlock className="h-9 w-9 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((__, cellIdx) => (
              <div key={cellIdx} className="space-y-1.5">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
            ))}
          </div>

          <div className="divide-y divide-[var(--asis-border)] rounded-xl border border-[var(--asis-border)]">
            {Array.from({ length: 3 }).map((__, rowIdx) => (
              <div key={rowIdx} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <SkeletonBlock className="h-3.5 w-36" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function UsageMetricsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4" role="status" aria-busy="true" aria-label="Loading usage metrics">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <SkeletonBlock className="h-3 w-14" />
          <SkeletonBlock className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

const CHART_BAR_HEIGHTS = ['38%', '56%', '46%', '72%', '62%', '84%', '54%'];

export function TrafficChartSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading traffic usage history chart"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <SkeletonBlock className="h-3.5 w-24" />
          <SkeletonBlock className="h-3.5 w-20" />
          <SkeletonBlock className="h-3.5 w-20" />
        </div>
        <SkeletonBlock className="h-3.5 w-16" />
      </div>

      <div className="flex h-[260px] items-end gap-3 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface-2)]/50 px-5 pb-6 pt-8">
        {CHART_BAR_HEIGHTS.map((height, index) => (
          <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2 h-full">
            <div className="flex w-full max-w-[38px] flex-1 items-end gap-1.5">
              <div
                aria-hidden="true"
                style={{ height }}
                className="asis-skeleton flex-1 rounded-t-md"
              />
              <div
                aria-hidden="true"
                style={{ height: `${Math.max(20, parseInt(height, 10) - 22)}%` }}
                className="asis-skeleton flex-1 rounded-t-md opacity-75"
              />
            </div>
            <SkeletonBlock className="h-2.5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface StateBoxProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: StateBoxProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--asis-border-strong)] bg-[var(--asis-surface)] px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]">
        <Inbox className="w-5 h-5" aria-hidden="true" />
      </div>
      <h4 className="mt-3.5 text-sm font-semibold text-[var(--asis-text-primary)]">{title}</h4>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--asis-text-secondary)]">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorState({ title, description, actionLabel, onAction }: StateBoxProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-6 py-10 text-center dark:border-[#7F1D1D] dark:bg-[#3A0C12]/40"
    >
      <AlertCircle className="w-8 h-8 text-[#D64545] dark:text-[#F07070]" aria-hidden="true" />
      <h4 className="mt-3 text-sm font-semibold text-[var(--asis-text-primary)]">{title}</h4>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--asis-text-secondary)]">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
