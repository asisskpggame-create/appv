import React, { useEffect, useId, useRef, useState } from 'react';
import { Info, Shield, ShieldAlert } from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  Button,
  Dialog,
  StatusBanner,
  ToggleSwitch,
} from '../../design-system/components';
import type { TargetPlatform } from '../../engine';

interface KillSwitchSettingsProps {
  platform: TargetPlatform;
  enabled: boolean;
  allowLocalNetwork?: boolean;
  onChange: (nextEnabled: boolean) => void;
}

function getPlatformMechanismLabel(platform: TargetPlatform, isFa: boolean): string {
  switch (platform) {
    case 'android':
      return isFa
        ? 'اندروید (Always-on VPN و مسدودسازی بدون VPN)'
        : 'Android Always-on VPN & strict VpnService routing';
    case 'ios':
      return isFa
        ? 'آیفون و آیپد (NEPacketTunnelProvider On-Demand)'
        : 'iOS NEPacketTunnelProvider On-Demand strict tunnel rule';
    case 'windows':
      return isFa
        ? 'ویندوز (فایروال WFP و قوانین مسدودسازی sing-box)'
        : 'Windows Filtering Platform (WFP) & sing-box strict drop rules';
    case 'web':
      return isFa
        ? 'مرورگر وب (نیازمند کلاینت بومی اندروید، iOS یا ویندوز)'
        : 'Native OS client required (Android, iOS, or Windows)';
  }
}

export function KillSwitchSettings({
  platform,
  enabled,
  allowLocalNetwork = true,
  onChange,
}: KillSwitchSettingsProps) {
  const { locale } = usePreferences();
  const isFa = locale === 'fa-IR';
  const isWeb = platform === 'web';

  const tooltipId = useId();
  const tooltipContainerRef = useRef<HTMLDivElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!tooltipOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        tooltipContainerRef.current &&
        !tooltipContainerRef.current.contains(event.target as Node)
      ) {
        setTooltipOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tooltipOpen]);

  const handleSwitchToggle = (nextChecked: boolean) => {
    if (isWeb) return;
    if (nextChecked) {
      setConfirmOpen(true);
    } else {
      onChange(false);
    }
  };

  const handleConfirmEnable = () => {
    setConfirmOpen(false);
    onChange(true);
  };

  const mechanismText = getPlatformMechanismLabel(platform, isFa);

  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              enabled && !isWeb
                ? 'bg-[#DCFCE7] text-[#2BB673] dark:bg-[#0D2E1E] dark:text-[#3BC48A]'
                : 'bg-[var(--asis-primary-soft)] text-[var(--asis-accent-fg)]'
            }`}
          >
            {enabled && !isWeb ? (
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Shield className="h-4 w-4" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-[var(--asis-text-primary)]">
                {isFa ? 'قطع اضطراری اینترنت (Kill Switch)' : 'Kill Switch'}
              </p>

              {/* Descriptive Tooltip Trigger */}
              <div
                ref={tooltipContainerRef}
                className="relative inline-flex items-center"
                onMouseEnter={() => setTooltipOpen(true)}
                onMouseLeave={() => setTooltipOpen(false)}
              >
                <button
                  type="button"
                  aria-label={
                    isFa
                      ? 'توضیحات نحوه عملکرد Kill Switch'
                      : 'How OS-level Kill Switch works'
                  }
                  aria-expanded={tooltipOpen}
                  aria-describedby={tooltipOpen ? tooltipId : undefined}
                  onClick={() => setTooltipOpen((prev) => !prev)}
                  onFocus={() => setTooltipOpen(true)}
                  onBlur={() => setTooltipOpen(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--asis-text-secondary)] transition-colors hover:bg-[var(--asis-primary-soft)] hover:text-[var(--asis-accent-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--asis-primary)] cursor-pointer"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                {tooltipOpen && (
                  <div
                    id={tooltipId}
                    role="tooltip"
                    className="absolute bottom-full start-0 z-40 mb-2 w-72 sm:w-80 rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] p-3.5 text-start text-xs leading-relaxed text-[var(--asis-text-primary)] shadow-lg"
                  >
                    <p className="font-semibold text-[var(--asis-text-primary)]">
                      {isFa
                        ? 'الزام سخت‌گیرانه اتصال VPN در سطح سیستم‌عامل'
                        : 'Strict OS-Level VPN Enforcement'}
                    </p>
                    <p className="mt-1 text-[var(--asis-text-secondary)]">
                      {isFa
                        ? 'هنگام فعال بودن Kill Switch، سیستم‌عامل تمام ترافیک اینترنت خارج از تونل رمزنگاری‌شده VPN را در زمان قطع، تغییر شبکه یا تلاش مجدد اتصال مسدود می‌کند تا هیچ داده یا IP واقعی نشت نکند.'
                        : 'When enabled, the operating system strictly blocks all outbound internet traffic outside the encrypted VPN tunnel during drops, handoffs, or reconnects to prevent IP leaks.'}
                    </p>
                    <p className="mt-2 border-t border-[var(--asis-border)] pt-2 font-mono text-[11px] text-[var(--asis-text-secondary)]">
                      {mechanismText}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--asis-text-secondary)]">
              {isWeb
                ? isFa
                  ? 'در مرورگر غیرفعال — نیازمند Android Always-on / iOS On-Demand / Windows WFP'
                  : 'Unavailable on Web — Requires Android Always-on, iOS On-Demand, or Windows WFP'
                : enabled
                  ? isFa
                    ? 'مسدودسازی خودکار ترافیک غیرتونلی در سطح سیستم‌عامل فعال است'
                    : 'Strictly blocking all non-VPN traffic at the OS level'
                  : isFa
                    ? 'جلوگیری از نشت ترافیک و IP واقعی هنگام قطع ناگهانی VPN'
                    : 'Blocks all outbound traffic outside the VPN tunnel if disconnected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`font-mono text-xs font-medium whitespace-nowrap ${
              isWeb
                ? 'text-[var(--asis-text-secondary)]'
                : enabled
                  ? 'text-[#2BB673] dark:text-[#3BC48A]'
                  : 'text-[var(--asis-text-secondary)]'
            }`}
          >
            {isWeb
              ? isFa
                ? 'فقط بومی'
                : 'Native Only'
              : enabled
                ? isFa
                  ? 'فعال'
                  : 'Enforced'
                : isFa
                  ? 'خاموش'
                  : 'Off'}
          </span>

          <ToggleSwitch
            disabled={isWeb}
            checked={!isWeb && enabled}
            onChange={handleSwitchToggle}
            ariaLabel={
              isFa
                ? 'تغییر وضعیت Kill Switch در سطح سیستم‌عامل'
                : 'Toggle OS-level Kill Switch'
            }
          />
        </div>
      </div>

      {/* Warning Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={
          isFa
            ? 'فعال‌سازی Kill Switch در سطح سیستم‌عامل؟'
            : 'Enable OS-Level Kill Switch?'
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              {isFa ? 'انصراف' : 'Cancel'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmEnable}>
              {isFa ? 'تایید و فعال‌سازی' : 'Enable Kill Switch'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <StatusBanner
            tone="warning"
            title={
              isFa
                ? 'اتصال اینترنت بدون VPN به‌طور کامل مسدود می‌شود'
                : 'Non-VPN internet access will be strictly blocked'
            }
            description={
              isFa
                ? 'با فعال شدن این قابلیت، اگر تونل VPN قطع شود یا سرور در دسترس نباشد، دسترسی به اینترنت تا برقراری مجدد اتصال امن متوقف خواهد شد.'
                : 'While active, if the VPN tunnel disconnects, stalls, or cannot reach a server, all internet access will pause until VPN connectivity is restored or Kill Switch is disabled.'
            }
          />

          <ul className="space-y-2 text-xs text-[var(--asis-text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--asis-primary)] shrink-0" aria-hidden="true" />
              <span>
                {isFa
                  ? `سازوکار پلتفرم: ${mechanismText}`
                  : `Enforcement mechanism: ${mechanismText}`}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--asis-primary)] shrink-0" aria-hidden="true" />
              <span>
                {allowLocalNetwork
                  ? isFa
                    ? 'دسترسی به شبکه محلی (LAN) طبق تنظیم فعلی همچنان مجاز می‌ماند.'
                    : 'Local network (LAN) routes remain reachable per your current LAN Bypass setting.'
                  : isFa
                    ? 'ترافیک شبکه محلی (LAN) نیز همراه با اینترنت عمومی مسدود خواهد شد.'
                    : 'Local network (LAN) traffic is also blocked because LAN Bypass is currently off.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--asis-primary)] shrink-0" aria-hidden="true" />
              <span>
                {isFa
                  ? 'در صورت نیاز به اینترنت مستقیم، می‌توانید هر زمان این سوییچ را خاموش کنید.'
                  : 'You can disable Kill Switch here at any time to restore direct network access.'}
              </span>
            </li>
          </ul>
        </div>
      </Dialog>
    </>
  );
}
