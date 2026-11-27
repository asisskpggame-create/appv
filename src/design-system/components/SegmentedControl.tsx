import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  wrap?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  wrap = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-full bg-[var(--asis-surface-2)] p-1 ${
        wrap ? 'flex-wrap' : ''
      }`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-[34px] rounded-full px-4 py-1 text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)] ${
              active
                ? 'bg-[var(--asis-primary)] text-white shadow-[0_6px_16px_-6px_rgba(var(--asis-glow-rgb),0.8)]'
                : 'text-[var(--asis-text-secondary)] hover:text-[var(--asis-text-primary)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
