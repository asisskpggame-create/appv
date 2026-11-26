import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
  interactive?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  elevated = false,
  interactive = false,
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--asis-border)] bg-[var(--asis-surface)] text-[var(--asis-text-primary)] ${
        elevated
          ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_1px_2px_rgba(11,17,32,0.04),0_20px_44px_-22px_rgba(var(--asis-glow-rgb),0.22)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_52px_-20px_rgba(0,0,0,0.88)]'
          : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(11,17,32,0.03)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_2px_10px_rgba(0,0,0,0.38)]'
      } ${
        interactive
          ? 'group transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[var(--asis-border-strong)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_26px_-14px_rgba(var(--asis-glow-rgb),0.26)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_30px_-14px_rgba(0,0,0,0.8)]'
          : ''
      } ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
