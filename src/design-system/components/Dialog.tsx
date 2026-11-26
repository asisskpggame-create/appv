import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04070F]/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asis-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--asis-border)] bg-[var(--asis-surface)] p-6 text-start text-[var(--asis-text-primary)] shadow-[0_24px_48px_-16px_rgba(11,17,32,0.22)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_60px_-14px_rgba(0,0,0,0.88)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="asis-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--asis-text-secondary)] transition-colors hover:bg-[var(--asis-surface-2)] hover:text-[var(--asis-text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 text-sm leading-relaxed text-[var(--asis-text-secondary)]">
          {children}
        </div>
        {footer && (
          <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
