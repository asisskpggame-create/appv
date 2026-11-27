import React from 'react';
import { Loader2, Power, ShieldCheck } from 'lucide-react';
import type { ConnectionState } from '../../engine';
import { tapHaptic } from '../../client/haptics';

interface ConnectionButtonProps {
  connState: ConnectionState;
  hasSelectedServer: boolean;
  isFa: boolean;
  onToggle: () => void;
}

/**
 * The one primary control of the app: a glowing orb inside a dotted ring.
 * Idle: glass orb with a soft palette glow. Connecting: the dotted ring spins.
 * Connected: green orb with breathing halos. Error: red orb.
 */
export function ConnectionButton({ connState, hasSelectedServer, isFa, onToggle }: ConnectionButtonProps) {
  const isConnected = connState === 'Connected';
  const isConnecting =
    connState === 'Preparing' || connState === 'Connecting' || connState === 'Reconnecting';
  const isDisconnecting = connState === 'Disconnecting';
  const isBusy = isConnecting || isDisconnecting;
  const isError = connState === 'Error';

  const label = isConnected
    ? isFa ? 'قطع اتصال' : 'Disconnect'
    : isConnecting
      ? isFa ? 'در حال اتصال' : 'Connecting'
      : isDisconnecting
        ? isFa ? 'در حال قطع' : 'Disconnecting'
        : !hasSelectedServer
          ? isFa ? 'انتخاب سرور' : 'Choose server'
          : isFa ? 'اتصال' : 'Connect';

  const orbState = isConnected ? 'connected' : isError ? 'error' : isBusy ? 'busy' : 'idle';
  // Same two state colors as before; the orb itself reads them from CSS (--orb-rgb).
  const ringRgb = isConnected ? '43, 182, 115' : isError ? '214, 69, 69' : 'var(--asis-glow-rgb)';
  const iconTone = orbState === 'idle' ? 'text-[var(--asis-accent-fg)]' : 'text-white';

  return (
    <div
      className="relative flex h-[248px] w-[248px] select-none items-center justify-center"
      style={{ '--orb-rgb': ringRgb } as React.CSSProperties}
    >
      {/* Breathing halos while connected */}
      {isConnected && (
        <>
          <span className="asis-halo" aria-hidden="true" />
          <span className="asis-halo asis-halo-delay" aria-hidden="true" />
        </>
      )}

      {/* Dotted particle ring: slow drift when idle, fast spin while busy */}
      <span
        aria-hidden="true"
        className={`asis-dot-ring pointer-events-none absolute inset-0 rounded-full transition-opacity duration-500 ${
          isBusy ? 'asis-dial-orbit-active opacity-100' : isConnected ? 'asis-dial-orbit-slow opacity-90' : 'asis-dial-orbit-slow opacity-45'
        }`}
      />

      <button
        type="button"
        disabled={isBusy}
        aria-busy={isBusy}
        aria-label={isConnected ? 'Disconnect VPN' : 'Connect VPN'}
        data-state={orbState}
        onClick={() => {
          tapHaptic(18);
          onToggle();
        }}
        className={`asis-orb relative flex h-[148px] w-[148px] cursor-pointer flex-col items-center justify-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--asis-primary)] disabled:cursor-wait ${iconTone}`}
      >
        <span className="relative flex h-11 w-11 items-center justify-center">
          <Power
            className={`absolute h-10 w-10 transition-all duration-200 ${isBusy || isConnected ? 'scale-75 opacity-0' : 'opacity-100'}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Loader2
            className={`absolute h-10 w-10 animate-spin transition-opacity duration-200 ${isBusy ? 'opacity-100' : 'opacity-0'}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <ShieldCheck
            className={`absolute h-10 w-10 transition-all duration-200 ${isConnected ? 'opacity-100' : 'scale-75 opacity-0'}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>
        <span className="text-[14px] font-semibold">{label}</span>
      </button>
    </div>
  );
}
