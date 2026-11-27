import React from 'react';

interface QuotaRingProps {
  /** 0-100. Pass null when the server did not provide quota data. */
  percent: number | null;
  /** Small caption under the percentage, e.g. "used". */
  caption?: string;
  size?: number;
  className?: string;
}

/** Circular usage gauge with a neon arc (used by subscriptions and statistics). */
export function QuotaRing({ percent, caption, size = 132, className = '' }: QuotaRingProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const high = clamped >= 90;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={percent === null ? 'Usage unavailable' : `${clamped}% used`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--asis-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={high ? '#F59E0B' : 'var(--asis-primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${high ? 'rgba(245,158,11,0.7)' : 'rgba(var(--asis-glow-rgb),0.8)'})`,
            transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-bold">
          {percent === null ? '--' : `${clamped}%`}
        </span>
        {caption && (
          <span className="mt-0.5 text-[11px] text-[var(--asis-text-secondary)]">{caption}</span>
        )}
      </div>
    </div>
  );
}
