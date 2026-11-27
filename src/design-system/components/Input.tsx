import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  allowPasswordToggle?: boolean;
  /** Optional leading icon (e.g. user / lock). */
  icon?: React.ReactNode;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

export function Input({
  label,
  error,
  hint,
  type = 'text',
  allowPasswordToggle = false,
  icon,
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
  className = '',
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [revealed, setRevealed] = useState(false);

  const isPasswordField = type === 'password' && allowPasswordToggle;
  const effectiveType = isPasswordField ? (revealed ? 'text' : 'password') : type;
  const toggleLabel = revealed ? hidePasswordLabel : showPasswordLabel;

  return (
    <div className="flex flex-col gap-1.5 text-start">
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-[var(--asis-text-secondary)]"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-[var(--asis-text-secondary)]">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={effectiveType}
          aria-invalid={Boolean(error)}
          className={`w-full min-h-[48px] rounded-2xl border bg-[var(--asis-surface)] px-3.5 py-2 text-[15px] text-[var(--asis-text-primary)] placeholder:text-[var(--asis-text-secondary)]/60 transition-colors duration-150 focus:outline-none focus:ring-2 ${
            isPasswordField ? 'pe-11' : ''
          } ${icon ? 'ps-10' : ''} ${
            error
              ? 'border-[#D64545] focus:ring-[#D64545]/20 dark:border-[#D64545]'
              : 'border-[var(--asis-border)] focus:border-[var(--asis-primary)] focus:ring-[var(--asis-primary)]/25'
          } ${className}`}
          {...props}
        />
        {isPasswordField && (
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={toggleLabel}
            aria-pressed={revealed}
            title={toggleLabel}
            className="absolute inset-y-0 end-0 flex items-center justify-center rounded-e-xl px-3 text-[var(--asis-text-secondary)] transition-colors hover:text-[var(--asis-accent-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--asis-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {revealed ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p className="text-xs font-medium text-[#D64545] dark:text-[#F07070]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{hint}</p>
      ) : null}
    </div>
  );
}
