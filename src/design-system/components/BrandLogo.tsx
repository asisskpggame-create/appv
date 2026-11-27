import React, { useId } from 'react';

interface BrandLogoProps {
  className?: string;
  glow?: boolean;
}

export function BrandLogo({ className = 'w-7 h-7', glow = false }: BrandLogoProps) {
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className}${glow ? ' asis-logo-glow' : ''}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="3" x2="30" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--asis-primary-hover)" />
          <stop offset="100%" stopColor="var(--asis-primary-active)" />
        </linearGradient>
      </defs>
      <path
        d="M18 2.5L5 7.8V16.9C5 24.7 10.6 31.6 18 33.5C25.4 31.6 31 24.7 31 16.9V7.8L18 2.5Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M18 4.8L7.2 9.2V16.8C7.2 23.4 11.8 29.2 18 31C24.2 29.2 28.8 23.4 28.8 16.8V9.2L18 4.8Z"
        stroke="#FFFFFF"
        strokeOpacity="0.24"
        strokeWidth="1"
      />
      <path
        d="M18 9.2L11.6 24.8H14.8L16.1 21.3H19.9L21.2 24.8H24.4L18 9.2ZM17 18.7L18 15.8L19 18.7H17Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
