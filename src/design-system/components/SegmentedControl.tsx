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
      className={`inline-flex items-center gap-1 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface-2)] p-1 ${
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
            className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--asis-primary)] ${
              active
                ? 'bg-[var(--asis-surface)] text-[var(--asis-text-primary)] shadow-[0_1px_2px_rgba(11,17,32,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_4px_rgba(0,0,0,0.45)]'
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
