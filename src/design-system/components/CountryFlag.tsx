import React, { useId } from 'react';

interface CountryFlagProps {
  code?: string | null;
  emoji?: string | null;
  className?: string;
}

/**
 * Renders crisp cross-platform SVG national flags (works reliably on Windows
 * where emoji regional indicators often render as plain ASCII letters) with
 * graceful fallback to emoji or ISO code badge.
 */
export function CountryFlag({ code, emoji, className = 'w-5 h-3.5' }: CountryFlagProps) {
  const clipId = useId();
  const upper = code?.toUpperCase().trim() ?? '';

  const renderSvgContent = (): React.ReactNode | null => {
    switch (upper) {
      case 'DE':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#111827" />
            <rect width="24" height="5.34" y="5.33" fill="#DC2626" />
            <rect width="24" height="5.34" y="10.66" fill="#FACC15" />
          </>
        );
      case 'NL':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#B91C1C" />
            <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#1D4ED8" />
          </>
        );
      case 'FR':
        return (
          <>
            <rect width="8" height="16" x="0" fill="#1D4ED8" />
            <rect width="8" height="16" x="8" fill="#FFFFFF" />
            <rect width="8" height="16" x="16" fill="#DC2626" />
          </>
        );
      case 'IT':
        return (
          <>
            <rect width="8" height="16" x="0" fill="#16A34A" />
            <rect width="8" height="16" x="8" fill="#FFFFFF" />
            <rect width="8" height="16" x="16" fill="#DC2626" />
          </>
        );
      case 'RO':
        return (
          <>
            <rect width="8" height="16" x="0" fill="#1D4ED8" />
            <rect width="8" height="16" x="8" fill="#FACC15" />
            <rect width="8" height="16" x="16" fill="#DC2626" />
          </>
        );
      case 'BE':
        return (
          <>
            <rect width="8" height="16" x="0" fill="#111827" />
            <rect width="8" height="16" x="8" fill="#FACC15" />
            <rect width="8" height="16" x="16" fill="#DC2626" />
          </>
        );
      case 'IE':
        return (
          <>
            <rect width="8" height="16" x="0" fill="#16A34A" />
            <rect width="8" height="16" x="8" fill="#FFFFFF" />
            <rect width="8" height="16" x="16" fill="#F97316" />
          </>
        );
      case 'AT':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#DC2626" />
            <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#DC2626" />
          </>
        );
      case 'RU':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="5.33" fill="#1D4ED8" />
            <rect width="24" height="5.34" y="10.66" fill="#DC2626" />
          </>
        );
      case 'PL':
        return (
          <>
            <rect width="24" height="8" y="0" fill="#FFFFFF" />
            <rect width="24" height="8" y="8" fill="#DC2626" />
          </>
        );
      case 'UA':
        return (
          <>
            <rect width="24" height="8" y="0" fill="#2563EB" />
            <rect width="24" height="8" y="8" fill="#FACC15" />
          </>
        );
      case 'BG':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="5.33" fill="#16A34A" />
            <rect width="24" height="5.34" y="10.66" fill="#DC2626" />
          </>
        );
      case 'FI':
        return (
          <>
            <rect width="24" height="16" fill="#FFFFFF" />
            <rect width="4" height="16" x="6.5" fill="#1D4ED8" />
            <rect width="24" height="4" y="6" fill="#1D4ED8" />
          </>
        );
      case 'SE':
        return (
          <>
            <rect width="24" height="16" fill="#1D4ED8" />
            <rect width="3.5" height="16" x="7" fill="#FACC15" />
            <rect width="24" height="3.5" y="6.25" fill="#FACC15" />
          </>
        );
      case 'NO':
        return (
          <>
            <rect width="24" height="16" fill="#DC2626" />
            <rect width="4.5" height="16" x="6.5" fill="#FFFFFF" />
            <rect width="24" height="4.5" y="5.75" fill="#FFFFFF" />
            <rect width="2.5" height="16" x="7.5" fill="#1E3A8A" />
            <rect width="24" height="2.5" y="6.75" fill="#1E3A8A" />
          </>
        );
      case 'CH':
        return (
          <>
            <rect width="24" height="16" fill="#DC2626" />
            <rect width="3.6" height="10" x="10.2" y="3" fill="#FFFFFF" />
            <rect width="10" height="3.6" x="7" y="6.2" fill="#FFFFFF" />
          </>
        );
      case 'GB':
        return (
          <>
            <rect width="24" height="16" fill="#1E3A8A" />
            <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
            <path d="M0 0L24 16M24 0L0 16" stroke="#DC2626" strokeWidth="1.5" />
            <rect width="5" height="16" x="9.5" fill="#FFFFFF" />
            <rect width="24" height="5" y="5.5" fill="#FFFFFF" />
            <rect width="3" height="16" x="10.5" fill="#DC2626" />
            <rect width="24" height="3" y="6.5" fill="#DC2626" />
          </>
        );
      case 'US':
        return (
          <>
            <rect width="24" height="16" fill="#FFFFFF" />
            <rect width="24" height="2.3" y="0" fill="#DC2626" />
            <rect width="24" height="2.3" y="4.6" fill="#DC2626" />
            <rect width="24" height="2.3" y="9.2" fill="#DC2626" />
            <rect width="24" height="2.3" y="13.7" fill="#DC2626" />
            <rect width="11" height="9.2" fill="#1E3A8A" />
            <circle cx="3" cy="2.5" r="0.7" fill="#FFFFFF" />
            <circle cx="6" cy="2.5" r="0.7" fill="#FFFFFF" />
            <circle cx="9" cy="2.5" r="0.7" fill="#FFFFFF" />
            <circle cx="4.5" cy="5" r="0.7" fill="#FFFFFF" />
            <circle cx="7.5" cy="5" r="0.7" fill="#FFFFFF" />
            <circle cx="3" cy="7.2" r="0.7" fill="#FFFFFF" />
            <circle cx="6" cy="7.2" r="0.7" fill="#FFFFFF" />
            <circle cx="9" cy="7.2" r="0.7" fill="#FFFFFF" />
          </>
        );
      case 'TR':
        return (
          <>
            <rect width="24" height="16" fill="#DC2626" />
            <circle cx="9.8" cy="8" r="4" fill="#FFFFFF" />
            <circle cx="11" cy="8" r="3.2" fill="#DC2626" />
            <circle cx="15.2" cy="8" r="1.3" fill="#FFFFFF" />
          </>
        );
      case 'AE':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#16A34A" />
            <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#111827" />
            <rect width="6" height="16" x="0" fill="#DC2626" />
          </>
        );
      case 'CA':
        return (
          <>
            <rect width="6" height="16" x="0" fill="#DC2626" />
            <rect width="12" height="16" x="6" fill="#FFFFFF" />
            <rect width="6" height="16" x="18" fill="#DC2626" />
            <path d="M12 4L13.5 7.5L16 7L14.5 9.5L15.5 11.5H8.5L9.5 9.5L8 7L10.5 7.5Z" fill="#DC2626" />
          </>
        );
      case 'JP':
        return (
          <>
            <rect width="24" height="16" fill="#FFFFFF" />
            <circle cx="12" cy="8" r="4.2" fill="#DC2626" />
          </>
        );
      case 'SG':
        return (
          <>
            <rect width="24" height="8" y="0" fill="#DC2626" />
            <rect width="24" height="8" y="8" fill="#FFFFFF" />
            <circle cx="5.5" cy="4" r="2.2" fill="#FFFFFF" />
            <circle cx="6.4" cy="4" r="1.8" fill="#DC2626" />
          </>
        );
      case 'ES':
        return (
          <>
            <rect width="24" height="4" y="0" fill="#DC2626" />
            <rect width="24" height="8" y="4" fill="#FACC15" />
            <rect width="24" height="4" y="12" fill="#DC2626" />
          </>
        );
      case 'HK':
        return (
          <>
            <rect width="24" height="16" fill="#DC2626" />
            <circle cx="12" cy="8" r="3.4" fill="#FFFFFF" />
          </>
        );
      case 'KR':
        return (
          <>
            <rect width="24" height="16" fill="#FFFFFF" />
            <path d="M12 4A4 4 0 0 1 12 12A2 2 0 0 1 12 8A2 2 0 0 0 12 4Z" fill="#DC2626" />
            <path d="M12 12A4 4 0 0 1 12 4A2 2 0 0 1 12 8A2 2 0 0 0 12 12Z" fill="#1D4ED8" />
          </>
        );
      case 'IN':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#F97316" />
            <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#16A34A" />
            <circle cx="12" cy="8" r="1.8" fill="none" stroke="#1D4ED8" strokeWidth="0.9" />
          </>
        );
      case 'AU':
        return (
          <>
            <rect width="24" height="16" fill="#1E3A8A" />
            <rect width="10" height="7" fill="#1E40AF" />
            <rect width="2" height="7" x="4" fill="#FFFFFF" />
            <rect width="10" height="2" y="2.5" fill="#FFFFFF" />
            <circle cx="18" cy="5" r="1.2" fill="#FFFFFF" />
            <circle cx="16" cy="11" r="1.1" fill="#FFFFFF" />
            <circle cx="20" cy="10" r="1.1" fill="#FFFFFF" />
          </>
        );
      case 'BR':
        return (
          <>
            <rect width="24" height="16" fill="#16A34A" />
            <polygon points="12,2.5 21,8 12,13.5 3,8" fill="#FACC15" />
            <circle cx="12" cy="8" r="2.8" fill="#1D4ED8" />
          </>
        );
      case 'IR':
        return (
          <>
            <rect width="24" height="5.34" y="0" fill="#16A34A" />
            <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#DC2626" />
          </>
        );
      default:
        return null;
    }
  };

  const svgBody = renderSvgContent();
  if (svgBody) {
    return (
      <svg
        viewBox="0 0 24 16"
        className={`inline-block shrink-0 rounded-[3px] ring-1 ring-black/10 dark:ring-white/15 ${className}`}
        aria-hidden="true"
      >
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2" />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>{svgBody}</g>
      </svg>
    );
  }

  if (emoji) {
    return (
      <span className="inline-block shrink-0 text-sm leading-none" aria-hidden="true">
        {emoji}
      </span>
    );
  }

  if (upper) {
    return (
      <span className="inline-flex h-4 min-w-[22px] items-center justify-center rounded-[3px] border border-[#DCE6F5] bg-[#F6F9FE] px-1 font-mono text-[9px] font-semibold text-[#64748B] dark:border-[#1B2845] dark:bg-[#0B1324] dark:text-[#94A3B8]">
        {upper}
      </span>
    );
  }

  return null;
}
