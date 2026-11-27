import React from 'react';

interface BrandLogoProps {
  className?: string;
  glow?: boolean;
}

/** Official ASiS "AS" neon-ring mark (public/assets/asis-logo.png). */
export function BrandLogo({ className = 'w-7 h-7', glow = false }: BrandLogoProps) {
  return (
    <img
      src="/assets/asis-logo.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`${className} rounded-full object-cover${glow ? ' asis-logo-glow' : ''}`}
    />
  );
}
