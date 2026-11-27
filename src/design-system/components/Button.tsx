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
    'bg-[var(--asis-primary)] hover:bg-[var(--asis-primary-hover)] active:bg-[var(--asis-primary-active)] text-white border border-transparent shadow-[0_8px_22px_-8px_rgba(var(--asis-glow-rgb),0.7)]',
  secondary:
    'bg-[var(--asis-primary-soft)] hover:brightness-95 dark:hover:brightness-125 text-[var(--asis-accent-fg)] border border-transparent',
  outline:
    'bg-transparent hover:bg-[var(--asis-surface-2)] text-[var(--asis-text-primary)] border border-[var(--asis-border-strong)]',
  danger:
    'bg-[#D64545] hover:bg-[#C23939] text-white border border-transparent',
  ghost:
    'bg-transparent hover:bg-[var(--asis-surface-2)] text-[var(--asis-text-primary)] border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3.5 py-1.5 text-[13px]',
  md: 'min-h-[44px] px-4.5 py-2 text-sm',
  lg: 'min-h-[52px] px-6 py-2.5 text-[15px]',
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
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : icon ? (
        <span className="inline-flex shrink-0 transition-transform duration-150 ">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
