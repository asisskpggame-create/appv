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
        isSmall ? 'h-5 w-9' : 'h-[26px] w-[46px]'
      } ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${
        checked
          ? 'border-transparent bg-[var(--asis-primary)]'
          : 'border-transparent bg-[var(--asis-border-strong)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${
          isSmall
            ? `h-3.5 w-3.5 ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`
            : `h-5 w-5 ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`
        }`}
      />
    </button>
  );
}
