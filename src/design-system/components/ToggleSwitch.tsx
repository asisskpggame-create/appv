import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  size = 'md',
}: ToggleSwitchProps) {
  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={`relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--asis-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--asis-surface)] ${
        isSmall ? 'h-5 w-9' : 'h-6 w-11'
      } ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${
        checked
          ? 'border-[var(--asis-primary)] bg-[var(--asis-primary)] dark:shadow-[0_0_12px_rgba(var(--asis-glow-rgb),0.7)]'
          : 'border-[var(--asis-border-strong)] bg-[var(--asis-surface-2)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block rounded-full bg-white shadow-xs transition-transform duration-150 ${
          isSmall
            ? `h-3.5 w-3.5 ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`
            : `h-4 w-4 ${checked ? 'translate-x-5.5' : 'translate-x-1'}`
        }`}
      />
    </button>
  );
}
