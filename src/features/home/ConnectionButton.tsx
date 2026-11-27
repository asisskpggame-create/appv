import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Power, ShieldCheck } from 'lucide-react';
import type { ConnectionState } from '../../engine';
import { tapHaptic } from '../../client/haptics';

interface ConnectionButtonProps {
  connState: ConnectionState;
  hasSelectedServer: boolean;
  isFa: boolean;
  onToggle: () => void;
}

interface MagneticOffset {
  nx: number;
  ny: number;
  hovered: boolean;
}

const INITIAL_OFFSET: MagneticOffset = { nx: 0, ny: 0, hovered: false };

export function ConnectionButton({
  connState,
  hasSelectedServer,
  isFa,
  onToggle,
}: ConnectionButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [magnetic, setMagnetic] = useState<MagneticOffset>(INITIAL_OFFSET);
  const [pressed, setPressed] = useState(false);

  const isConnected = connState === 'Connected';
  const isConnecting =
    connState === 'Preparing' || connState === 'Connecting' || connState === 'Reconnecting';
  const isDisconnecting = connState === 'Disconnecting';
  const isBusy = isConnecting || isDisconnecting;
  const isError = connState === 'Error';

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || prefersReducedMotion()) return;
    const node = containerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const halfW = rect.width / 2 || 1;
    const halfH = rect.height / 2 || 1;

    const rawNx = Math.max(-1, Math.min(1, (e.clientX - cx) / halfW));
    const rawNy = Math.max(-1, Math.min(1, (e.clientY - cy) / halfH));

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setMagnetic({ nx: rawNx, ny: rawNy, hovered: true });
    });
  };

  const handlePointerLeave = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setPressed(false);
    setMagnetic(INITIAL_OFFSET);
  };

  const ringAccentStyle = isConnected
    ? undefined
    : isError
      ? undefined
      : { color: 'var(--asis-primary)' };

  const ringAccentClass = isConnected
    ? 'text-[#16A34A] dark:text-[#22C55E]'
    : isError
      ? 'text-[#DC2626] dark:text-[#F87171]'
      : '';

  const buttonLabel = isConnected
    ? isFa
      ? 'قطع اتصال'
      : 'Disconnect'
    : isConnecting
      ? isFa
        ? 'در حال اتصال...'
        : 'Connecting...'
      : isDisconnecting
        ? isFa
          ? 'در حال قطع...'
          : 'Disconnecting...'
        : !hasSelectedServer
          ? isFa
            ? 'انتخاب سرور'
            : 'Select Server'
          : isFa
            ? 'اتصال امن'
            : 'Connect';

  const orbTranslateX = magnetic.nx * 8;
  const orbTranslateY = magnetic.ny * 8;
  const ringTranslateX = magnetic.nx * 3.5;
  const ringTranslateY = magnetic.ny * 3.5;
  const innerTranslateX = magnetic.nx * 2.5;
  const innerTranslateY = magnetic.ny * 2.5;
  const orbScale = pressed ? 0.955 : magnetic.hovered && !isBusy ? 1.035 : 1;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative flex h-60 w-60 select-none items-center justify-center"
    >
      {/* Ambient Glowing Orb Aura (layered cross-fade for smooth state transitions) */}
      <div
        aria-hidden="true"
        style={{
          transform: `translate3d(${ringTranslateX}px, ${ringTranslateY}px, 0)`,
        }}
        className="pointer-events-none absolute inset-6 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Active Theme / Connecting Aura */}
        <div
          style={{
            background:
              'radial-gradient(circle, rgba(var(--asis-glow-rgb), 0.48) 0%, rgba(var(--asis-glow-rgb), 0.18) 48%, transparent 72%)',
          }}
          className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${
            isConnected || isError
              ? 'opacity-0'
              : isConnecting
                ? 'asis-orb-breathe'
                : magnetic.hovered
                  ? 'opacity-80'
                  : 'opacity-50'
          }`}
        />
        {/* Connected Emerald Aura */}
        <div
          className={`absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(22,163,74,0.48)_0%,rgba(34,197,94,0.18)_48%,transparent_72%)] blur-xl transition-opacity duration-500 ${
            isConnected ? (magnetic.hovered ? 'opacity-85' : 'opacity-65') : 'opacity-0'
          }`}
        />
        {/* Error Crimson Aura */}
        <div
          className={`absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.35)_0%,rgba(239,68,68,0.12)_48%,transparent_72%)] blur-xl transition-opacity duration-500 ${
            isError ? 'opacity-65' : 'opacity-0'
          }`}
        />
      </div>

      {/* Calibrated Concentric Precision Rings */}
      <svg
        viewBox="0 0 240 240"
        style={{
          ...ringAccentStyle,
          transform: `translate3d(${ringTranslateX}px, ${ringTranslateY}px, 0)`,
        }}
        className={`pointer-events-none h-60 w-60 transition-[color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${ringAccentClass}`}
        aria-hidden="true"
      >
        <circle
          cx="120"
          cy="120"
          r="112"
          fill="none"
          stroke="currentColor"
          strokeOpacity={magnetic.hovered ? '0.24' : '0.14'}
          strokeWidth="1"
          className="transition-opacity duration-300"
        />
        <circle
          cx="120"
          cy="120"
          r="102"
          fill="none"
          stroke="currentColor"
          strokeOpacity={isConnected ? '0.38' : magnetic.hovered ? '0.3' : '0.22'}
          strokeWidth="1.5"
          strokeDasharray="2 7"
          className={isConnected ? 'asis-dial-orbit-slow' : ''}
        />
        <circle
          cx="120"
          cy="120"
          r="91"
          fill="none"
          stroke="currentColor"
          strokeOpacity={isBusy ? '0.78' : isConnected ? '0.48' : '0.32'}
          strokeWidth={isBusy ? '2.5' : '2'}
          strokeDasharray={isBusy ? '44 20' : '36 16'}
          strokeLinecap="round"
          className={isBusy ? 'asis-dial-orbit-active' : 'transition-all duration-500'}
        />
        <circle
          cx="120"
          cy="120"
          r="80"
          fill="none"
          stroke="currentColor"
          strokeOpacity={isConnected || isConnecting ? '0.22' : '0.1'}
          strokeWidth="1"
          className="transition-opacity duration-500"
        />
      </svg>

      {/* Tactile Magnetic Glowing Orb Button */}
      <button
        type="button"
        disabled={isBusy}
        aria-busy={isBusy}
        aria-label={isConnected ? 'Disconnect VPN' : 'Connect VPN'}
        onPointerDown={() => {
          if (!isBusy) setPressed(true);
        }}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onClick={() => {
          tapHaptic(18);
          onToggle();
        }}
        style={{
          transform: `translate3d(${orbTranslateX}px, ${orbTranslateY}px, 0) scale(${orbScale})`,
          boxShadow: isConnected
            ? '0 18px 42px -8px rgba(22,163,74,0.58), 0 0 26px -4px rgba(34,197,94,0.38)'
            : isError
              ? '0 12px 28px -10px rgba(220,38,38,0.28)'
              : '0 18px 42px -10px rgba(var(--asis-glow-rgb), 0.58), 0 0 28px -6px rgba(var(--asis-glow-rgb), 0.36)',
        }}
        className={`group absolute flex h-36 w-36 flex-col items-center justify-center overflow-hidden rounded-full ring-1 ring-inset ring-white/30 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--asis-primary)] disabled:cursor-wait cursor-pointer ${
          isError ? 'border border-[#FECACA] dark:border-[#7F1D1D]' : ''
        }`}
      >
        {/* Cross-fading Surface Layers for Smooth Connecting -> Connected Morph */}
        <span
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, var(--asis-primary-hover) 0%, var(--asis-primary) 52%, var(--asis-primary-active) 100%)',
          }}
          className={`absolute inset-0 transition-opacity duration-500 ${
            isConnected || isError ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute inset-0 bg-gradient-to-b from-[#2DD46B] via-[#16A34A] to-[#117A37] transition-opacity duration-500 ${
            isConnected ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute inset-0 bg-[#FEF2F2] dark:bg-[#2A0E14] transition-opacity duration-300 ${
            isError ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Top Specular Glass Rim */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-3 top-1.5 h-10 rounded-full bg-gradient-to-b from-white/35 to-transparent transition-opacity duration-300 ${
            isError ? 'opacity-15' : 'opacity-80'
          }`}
        />

        {/* Dynamic Magnetic Spotlight Sheen */}
        <span
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at ${50 + magnetic.nx * 28}% ${
              50 + magnetic.ny * 28
            }%, rgba(255,255,255,0.32), transparent 62%)`,
          }}
          className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
            magnetic.hovered && !isError ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Parallax Icon & Status Label */}
        <span
          style={{
            transform: `translate3d(${innerTranslateX}px, ${innerTranslateY}px, 0)`,
          }}
          className={`relative z-10 flex flex-col items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isError ? 'text-[#DC2626] dark:text-[#F87171]' : 'text-white'
          }`}
        >
          <span className="relative mb-2 flex h-8 w-8 items-center justify-center">
            <Power
              className={`absolute h-8 w-8 transition-all duration-300 ${
                isBusy || isConnected
                  ? 'scale-75 opacity-0'
                  : 'scale-100 opacity-100 group-hover:scale-110'
              }`}
              aria-hidden="true"
            />
            <Loader2
              className={`absolute h-8 w-8 animate-spin transition-all duration-300 ${
                isBusy ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
              aria-hidden="true"
            />
            <ShieldCheck
              className={`absolute h-8 w-8 transition-all duration-300 ${
                isConnected
                  ? 'scale-100 opacity-100 group-hover:scale-110'
                  : 'scale-75 opacity-0'
              }`}
              aria-hidden="true"
            />
          </span>

          <span className="text-sm font-semibold tracking-tight whitespace-nowrap transition-opacity duration-200">
            {buttonLabel}
          </span>
        </span>
      </button>
    </div>
  );
}
