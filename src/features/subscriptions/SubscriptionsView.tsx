import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  FileUp,
  Link2,
  QrCode,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { usePreferences } from '../../design-system/ThemeContext';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  SegmentedControl,
  StatusBanner,
  SubscriptionListSkeleton,
} from '../../design-system/components';
import type { AuthSession } from '../auth';
import {
  computeFingerprintSha256,
  formatBytesCompact,
  parseSubscriptionPayload,
  validateManualSubscriptionUrl,
} from './subscriptionParser';
import { subscriptionTranslations } from './subscriptionTranslations';
import type { SubscriptionRecord } from './types';

interface SubscriptionsViewProps {
  session?: AuthSession | null;
  activeSubscriptionId?: string | null;
  onSelectSubscription?: (sub: SubscriptionRecord) => void;
  subscriptions: SubscriptionRecord[];
  onSubscriptionsChange: React.Dispatch<React.SetStateAction<SubscriptionRecord[]>>;
}

type SubscriptionTab = 'imported' | 'account';
type ImportMethod = 'url' | 'clipboard' | 'qr' | 'file';

interface BrowserBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

function getBarcodeDetectorCtor(): (new (opts?: { formats?: string[] }) => BrowserBarcodeDetector) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BrowserBarcodeDetector;
  };
  return typeof w.BarcodeDetector === 'function' ? w.BarcodeDetector : null;
}

export function SubscriptionsView({
  session = null,
  activeSubscriptionId = null,
  onSelectSubscription,
  subscriptions,
  onSubscriptionsChange,
}: SubscriptionsViewProps) {
  const { locale } = usePreferences();
  const t = subscriptionTranslations[locale];

  const [tab, setTab] = useState<SubscriptionTab>('imported');
  const [importMethod, setImportMethod] = useState<ImportMethod>('url');
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [payloadInput, setPayloadInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const [accountSyncLoading, setAccountSyncLoading] = useState(false);
  const [accountSyncError, setAccountSyncError] = useState<string | null>(null);
  const [accountSyncCompleted, setAccountSyncCompleted] = useState(false);
  const [refreshingSubId, setRefreshingSubId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(activeSubscriptionId);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);

  const barcodeSupported = useMemo(() => getBarcodeDetectorCtor() !== null, []);
  const accountSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.source === 'account'),
    [subscriptions],
  );
  const importedSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.source === 'manual_import'),
    [subscriptions],
  );

  const effectiveSelectedId = activeSubscriptionId ?? selectedId;

  const handleSelect = (sub: SubscriptionRecord) => {
    setSelectedId(sub.id);
    onSelectSubscription?.(sub);
  };

  const registerManualSubscription = async (params: {
    method: ImportMethod;
    rawUrl?: string;
    rawPayload?: string;
    suggestedName?: string;
  }) => {
    setImportError(null);
    const trimmedUrl = params.rawUrl?.trim() ?? '';
    const trimmedPayload = params.rawPayload?.trim() ?? '';

    if (!trimmedUrl && !trimmedPayload) {
      setImportError(t.errUrlEmpty);
      return;
    }

    let normalizedUrl: string | undefined;
    if (trimmedUrl) {
      const check = validateManualSubscriptionUrl(trimmedUrl);
      if (!check.valid) {
        if (check.errorKey === 'malformed') setImportError(t.errUrlMalformed);
        else if (check.errorKey === 'insecure_scheme') setImportError(t.errUrlInsecure);
        else if (check.errorKey === 'blocked_host') setImportError(t.errUrlBlocked);
        else setImportError(t.errUrlEmpty);
        return;
      }
      normalizedUrl = check.normalizedUrl;
    }

    const parsed = trimmedPayload
      ? parseSubscriptionPayload(trimmedPayload)
      : { endpoints: [], formatDetected: 'unknown' as const };

    if (!normalizedUrl && parsed.endpoints.length === 0) {
      setImportError(t.errUnparsedPayload);
      return;
    }

    setImportLoading(true);
    try {
      const fingerprintSource = normalizedUrl ?? trimmedPayload;
      const fingerprintHash = await computeFingerprintSha256(fingerprintSource);

      const isDuplicate = subscriptions.some((s) => s.fingerprintHash === fingerprintHash);
      if (isDuplicate) {
        setImportError(t.errDuplicate);
        return;
      }

      // If authenticated against Phase 3 gateway with a URL, also register server-side
      if (session?.tokens.accessToken && normalizedUrl) {
        const res = await fetch('/api/v1/subscriptions/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.tokens.accessToken}`,
          },
          body: JSON.stringify({
            url: normalizedUrl,
            label: nameInput.trim() || params.suggestedName || 'Imported Subscription',
          }),
        });
        if (res.status === 409) {
          setImportError(t.errDuplicate);
          return;
        }
      }

      const now = new Date().toISOString();
      const id = `sub_${fingerprintHash.slice(0, 12)}`;
      const entry: SubscriptionRecord = {
        id,
        source: 'manual_import',
        importMethod: params.method,
        name: nameInput.trim() || params.suggestedName || `Imported (${params.method.toUpperCase()})`,
        type: 'custom',
        status: parsed.endpoints.length > 0 ? 'active' : 'unverified',
        fingerprintHash,
        totalBytes: null,
        usedBytes: null,
        remainingBytes: null,
        startsAt: now,
        expiresAt: null,
        allowedDevices: null,
        locations: Array.from(new Set(parsed.endpoints.map((e) => e.name))).slice(0, 12),
        endpoints: parsed.endpoints,
        lastSyncedAt: now,
        renewalAvailable: false,
      };

      onSubscriptionsChange((prev) => [entry, ...prev]);
      handleSelect(entry);
      setNameInput('');
      setUrlInput('');
      setPayloadInput('');
      setTab('imported');
    } finally {
      setImportLoading(false);
    }
  };

  const handleClipboardImport = async () => {
    setImportError(null);
    try {
      if (!navigator.clipboard?.readText) {
        setImportError(t.errClipboardDenied);
        return;
      }
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setImportError(t.errUrlEmpty);
        return;
      }
      if (text.startsWith('http://') || text.startsWith('https://')) {
        setUrlInput(text);
        await registerManualSubscription({ method: 'clipboard', rawUrl: text });
      } else {
        setPayloadInput(text);
        await registerManualSubscription({ method: 'clipboard', rawPayload: text });
      }
    } catch {
      setImportError(t.errClipboardDenied);
    }
  };

  const handleConfigFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > 512 * 1024) {
      setImportError(t.errFileTooLarge);
      return;
    }

    const content = await file.text();
    const baseName = file.name.replace(/\.[^.]+$/, '');
    await registerManualSubscription({
      method: 'file',
      rawPayload: content,
      suggestedName: baseName,
    });
  };

  const handleQrImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const Detector = getBarcodeDetectorCtor();
    if (!Detector) {
      setImportError(t.qrNoteUnsupported);
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const detector = new Detector({ formats: ['qr_code'] });
      const codes = await detector.detect(bitmap);
      const rawValue = codes[0]?.rawValue?.trim();
      if (!rawValue) {
        setImportError(t.errQrNoCode);
        return;
      }
      if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
        await registerManualSubscription({ method: 'qr', rawUrl: rawValue });
      } else {
        await registerManualSubscription({ method: 'qr', rawPayload: rawValue });
      }
    } catch {
      setImportError(t.errQrNoCode);
    }
  };

  const handleAccountSync = async () => {
    setAccountSyncLoading(true);
    setAccountSyncError(null);
    setAccountSyncCompleted(false);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (session?.tokens.accessToken) {
        headers.Authorization = `Bearer ${session.tokens.accessToken}`;
      }
      const res = await fetch('/api/v1/subscriptions', { headers });
      const body = (await res.json().catch(() => ({}))) as {
        items?: Array<{
          id?: string;
          source?: 'account' | 'manual_import';
          providerInstanceId?: string;
          name?: string;
          type?: SubscriptionRecord['type'];
          status?: SubscriptionRecord['status'];
          totalBytes?: number | null;
          usedBytes?: number | null;
          remainingBytes?: number | null;
          startsAt?: string | null;
          expiresAt?: string | null;
          allowedDevices?: number | null;
          locations?: string[];
          lastSyncedAt?: string;
          renewalInfo?: { available?: boolean };
        }>;
        error?: { code?: string; message?: string };
      };
      if (!res.ok) {
        setAccountSyncError(
          body.error?.message
            ? `${body.error.code ?? 'GATEWAY_ERROR'}: ${body.error.message}`
            : t.accountNotConnectedBody,
        );
        return;
      }

      if (Array.isArray(body.items)) {
        const syncedAccountSubs: SubscriptionRecord[] = body.items
          .filter((item) => item.source === 'account' && typeof item.id === 'string')
          .map((item) => ({
            id: item.id!,
            source: 'account',
            providerInstanceId: item.providerInstanceId,
            name: item.name || 'ASiS Subscription',
            type: item.type ?? 'combined',
            status: item.status ?? 'active',
            fingerprintHash: `acct_${item.id}`,
            totalBytes: item.totalBytes ?? null,
            usedBytes: item.usedBytes ?? null,
            remainingBytes: item.remainingBytes ?? null,
            startsAt: item.startsAt ?? null,
            expiresAt: item.expiresAt ?? null,
            allowedDevices: item.allowedDevices ?? null,
            locations: Array.isArray(item.locations) ? item.locations : [],
            endpoints: [],
            lastSyncedAt: item.lastSyncedAt ?? new Date().toISOString(),
            renewalAvailable: Boolean(item.renewalInfo?.available),
          }));

        onSubscriptionsChange((prev) => [
          ...syncedAccountSubs,
          ...prev.filter((s) => s.source !== 'account'),
        ]);
        setAccountSyncCompleted(true);
      }
    } catch {
      setAccountSyncError(t.accountNotConnectedBody);
    } finally {
      setAccountSyncLoading(false);
    }
  };

  const handleRefreshImported = async (subId: string) => {
    setRefreshingSubId(subId);
    const now = new Date().toISOString();
    try {
      onSubscriptionsChange((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, lastSyncedAt: now } : s)),
      );
      if (session?.tokens.accessToken) {
        await fetch(`/api/v1/subscriptions/${encodeURIComponent(subId)}/refresh`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.tokens.accessToken}`,
            Accept: 'application/json',
          },
        }).catch(() => undefined);
      }
    } finally {
      setRefreshingSubId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    onSubscriptionsChange((prev) => prev.filter((s) => s.id !== targetId));
    if (effectiveSelectedId === targetId) {
      setSelectedId(null);
    }
    if (session?.tokens.accessToken) {
      void fetch(`/api/v1/subscriptions/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.tokens.accessToken}`,
        },
      }).catch(() => undefined);
    }
    setDeleteTarget(null);
  };

  const visibleList = tab === 'account' ? accountSubscriptions : importedSubscriptions;

  return (
    <div className="space-y-8 text-start">
      {/* Header + Method Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--asis-border)] pb-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--asis-text-secondary)]">{t.subtitle}</p>
        </div>

        <SegmentedControl<SubscriptionTab>
          ariaLabel={t.title}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'imported', label: `${t.tabImported} (${importedSubscriptions.length})` },
            { value: 'account', label: `${t.tabAccount} (${accountSubscriptions.length})` },
          ]}
        />
      </div>

      {/* Method A: Account Subscriptions */}
      {tab === 'account' && (
        <div className="space-y-4">
          <StatusBanner
            tone={accountSyncCompleted && !accountSyncError ? 'success' : 'warning'}
            title={
              accountSyncCompleted && !accountSyncError
                ? locale === 'fa-IR'
                  ? 'اشتراک‌های حساب همگام‌سازی شدند'
                  : 'Account subscriptions synchronized'
                : t.accountNotConnectedTitle
            }
            description={accountSyncError ?? t.accountNotConnectedBody}
          />
          <div>
            <Button
              variant="secondary"
              size="sm"
              loading={accountSyncLoading}
              icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
              onClick={() => void handleAccountSync()}
            >
              {t.accountSyncBtn}
            </Button>
          </div>
          {accountSyncLoading ? (
            <SubscriptionListSkeleton cards={2} />
          ) : accountSubscriptions.length > 0 ? (
            <div className="space-y-4">
              {accountSubscriptions.map((sub) => (
                <Card key={sub.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold">{sub.name}</h4>
                      <p className="font-mono text-xs text-[var(--asis-text-secondary)]">
                        {sub.type} · {sub.status}
                      </p>
                    </div>
                    <Button
                      variant={effectiveSelectedId === sub.id ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => handleSelect(sub)}
                    >
                      {effectiveSelectedId === sub.id ? t.activeSelectedLabel : t.btnSelectActive}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Method B: Manual Subscription Import */}
      {tab === 'imported' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Import Form */}
          <Card className="lg:col-span-5 space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">{t.importTitle}</h3>
              <p className="text-xs leading-relaxed text-[var(--asis-text-secondary)]">
                {t.importSubtitle}
              </p>
            </div>

            <SegmentedControl<ImportMethod>
              ariaLabel={t.importTitle}
              value={importMethod}
              onChange={(m) => {
                setImportMethod(m);
                setImportError(null);
              }}
              wrap
              options={[
                { value: 'url', label: t.methodUrl },
                { value: 'clipboard', label: t.methodClipboard },
                { value: 'qr', label: t.methodQr },
                { value: 'file', label: t.methodFile },
              ]}
            />

            {importError && <StatusBanner tone="error" title={importError} />}

            <Input
              label={t.labelName}
              placeholder={t.placeholderName}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />

            {importMethod === 'url' && (
              <div className="space-y-4">
                <Input
                  label={t.labelUrl}
                  placeholder={t.placeholderUrl}
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (importError) setImportError(null);
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--asis-text-primary)]">
                    {t.labelPayload}
                  </label>
                  <textarea
                    rows={4}
                    value={payloadInput}
                    onChange={(e) => setPayloadInput(e.target.value)}
                    placeholder={t.placeholderPayload}
                    className="w-full rounded-xl border border-[var(--asis-border)] bg-[var(--asis-surface)] px-3.5 py-2 font-mono text-xs text-[var(--asis-text-primary)] placeholder:text-[var(--asis-text-secondary)]/70 focus:border-[var(--asis-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--asis-primary)]/20"
                  />
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  loading={importLoading}
                  icon={<Link2 className="w-4 h-4" aria-hidden="true" />}
                  onClick={() =>
                    void registerManualSubscription({
                      method: 'url',
                      rawUrl: urlInput,
                      rawPayload: payloadInput,
                    })
                  }
                >
                  {t.btnImportUrl}
                </Button>
              </div>
            )}

            {importMethod === 'clipboard' && (
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  loading={importLoading}
                  icon={<ClipboardPaste className="w-4 h-4" aria-hidden="true" />}
                  onClick={() => void handleClipboardImport()}
                >
                  {t.btnPasteClipboard}
                </Button>
              </div>
            )}

            {importMethod === 'qr' && (
              <div className="space-y-3">
                <StatusBanner
                  tone={barcodeSupported ? 'info' : 'warning'}
                  title={barcodeSupported ? t.methodQr : t.qrNoteUnsupported}
                  description={barcodeSupported ? t.qrNoteSupported : undefined}
                />
                <input
                  ref={qrFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleQrImageSelected(e)}
                />
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!barcodeSupported}
                  icon={<QrCode className="w-4 h-4" aria-hidden="true" />}
                  onClick={() => qrFileInputRef.current?.click()}
                >
                  {t.btnScanQrImage}
                </Button>
              </div>
            )}

            {importMethod === 'file' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.json,.conf,.yaml,.yml"
                  className="hidden"
                  onChange={(e) => void handleConfigFileSelected(e)}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  loading={importLoading}
                  icon={<FileUp className="w-4 h-4" aria-hidden="true" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t.btnSelectFile}
                </Button>
              </div>
            )}

            <div className="flex items-start gap-2 border-t border-[var(--asis-border)] pt-4 text-xs text-[var(--asis-text-secondary)]">
              <Shield className="w-4 h-4 mt-0.5 shrink-0 text-[var(--asis-accent-fg)]" />
              <span>{t.privacyNotice}</span>
            </div>
          </Card>

          {/* Subscriptions List & Details */}
          <div className="lg:col-span-7 space-y-4">
            {importLoading && <SubscriptionListSkeleton cards={1} />}
            {!importLoading && visibleList.length === 0 ? (
              <EmptyState title={t.emptyImportedTitle} description={t.emptyImportedBody} />
            ) : (
              visibleList.map((sub) => {
                if (refreshingSubId === sub.id) {
                  return <SubscriptionListSkeleton key={sub.id} cards={1} />;
                }
                const isSelected = effectiveSelectedId === sub.id;
                const isExpired =
                  sub.status === 'expired' ||
                  (sub.expiresAt !== null && Date.parse(sub.expiresAt) <= Date.now());

                return (
                  <Card
                    key={sub.id}
                    className={`space-y-4 ${
                      isSelected ? 'ring-2 ring-[var(--asis-primary)]' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--asis-border)] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-semibold">{sub.name}</h4>
                          <span className="font-mono text-xs text-[var(--asis-text-secondary)]">
                            · {sub.type} · {sub.status}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs text-[var(--asis-text-secondary)]">
                          SHA-256: {sub.fingerprintHash.slice(0, 16)}…
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={isSelected ? 'secondary' : 'primary'}
                          size="sm"
                          icon={isSelected ? <Check className="w-3.5 h-3.5" /> : undefined}
                          onClick={() => handleSelect(sub)}
                        >
                          {isSelected ? t.activeSelectedLabel : t.btnSelectActive}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                          onClick={() => void handleRefreshImported(sub.id)}
                        >
                          {t.btnRefresh}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t.btnDelete}
                          onClick={() => setDeleteTarget(sub)}
                        >
                          <Trash2 className="w-4 h-4 text-[#DC2626] dark:text-[#F87171]" />
                        </Button>
                      </div>
                    </div>

                    {isExpired && (
                      <StatusBanner
                        tone="warning"
                        title={t.expirationAlertTitle}
                        description={t.expirationAlertBody}
                      />
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-xs">
                      <div>
                        <p className="text-[var(--asis-text-secondary)]">{t.detailTotalTraffic}</p>
                        <p className="mt-0.5 font-mono font-semibold">
                          {formatBytesCompact(sub.totalBytes, t.unavailable)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--asis-text-secondary)]">{t.detailUsedTraffic}</p>
                        <p className="mt-0.5 font-mono font-semibold">
                          {formatBytesCompact(sub.usedBytes, t.unavailable)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--asis-text-secondary)]">
                          {t.detailRemainingTraffic}
                        </p>
                        <p className="mt-0.5 font-mono font-semibold">
                          {formatBytesCompact(sub.remainingBytes, t.unavailable)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--asis-text-secondary)]">{t.detailStartDate}</p>
                        <p className="mt-0.5 font-mono">
                          {sub.startsAt ? new Date(sub.startsAt).toLocaleDateString() : t.unavailable}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--asis-text-secondary)]">
                          {t.detailExpirationDate}
                        </p>
                        <p className="mt-0.5 font-mono">
                          {sub.expiresAt
                            ? new Date(sub.expiresAt).toLocaleDateString()
                            : t.unavailable}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--asis-text-secondary)]">{t.detailNodesCount}</p>
                        <p className="mt-0.5 font-mono font-semibold">{sub.endpoints.length}</p>
                      </div>
                    </div>

                    {sub.endpoints.length > 0 && (
                      <div className="divide-y divide-[var(--asis-border)] rounded-xl border border-[var(--asis-border)]">
                        {sub.endpoints.slice(0, 6).map((ep) => (
                          <div
                            key={ep.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                          >
                            <span className="font-medium truncate">{ep.name}</span>
                            <span className="font-mono text-[var(--asis-text-secondary)] shrink-0">
                              {ep.protocol} · {ep.supported ? 'Supported' : 'UNSUPPORTED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t.deleteConfirmTitle}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              {t.cancelBtn}
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
              {t.deleteConfirmBtn}
            </Button>
          </>
        }
      >
        {t.deleteConfirmBody}
      </Dialog>
    </div>
  );
}
