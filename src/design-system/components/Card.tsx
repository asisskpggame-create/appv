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
      className={`asis-glass rounded-3xl text-[var(--asis-text-primary)] ${
        elevated ? 'asis-glass-active' : ''
      } ${
        interactive
          ? 'transition-all duration-150 hover:brightness-110'
          : ''
      } ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
