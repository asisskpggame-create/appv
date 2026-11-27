import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--asis-primary)] hover:bg-[var(--asis-primary-hover)] active:bg-[var(--asis-primary-active)] text-white border border-[var(--asis-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_8px_-2px_rgba(var(--asis-glow-rgb),0.45)] dark:bg-gradient-to-b dark:from-[#3B98FF] dark:to-[#0F6FE0] dark:border-[#5FB0FF]/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_20px_-2px_rgba(var(--asis-glow-rgb),0.65)]',
  secondary:
    'bg-[var(--asis-primary-soft)] hover:brightness-95 dark:hover:brightness-115 text-[var(--asis-accent-fg)] border border-[var(--asis-primary-border)]',
  outline:
    'bg-[var(--asis-surface)] hover:bg-[var(--asis-surface-2)] text-[var(--asis-text-primary)] border border-[var(--asis-border-strong)] shadow-[0_1px_2px_rgba(11,17,32,0.03)] dark:shadow-none',
  danger:
    'bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#B91C1C] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:bg-[#DC2626] dark:hover:bg-[#EF4444]',
  ghost:
    'bg-transparent hover:bg-[var(--asis-primary-soft)] text-[var(--asis-text-primary)] border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3.5 py-1.5 text-xs',
  md: 'min-h-[42px] px-4.5 py-2 text-sm',
  lg: 'min-h-[48px] px-6 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[0.5px] active:translate-y-0 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : icon ? (
        <span className="inline-flex shrink-0 transition-transform duration-150 group-hover:scale-110">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
