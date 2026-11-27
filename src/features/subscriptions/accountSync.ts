import { registerEndpointLinks } from '../../engine/endpointLinks';
import { extractEndpointLinks, parseSubscriptionPayload } from './subscriptionParser';
import type { SubscriptionRecord } from './types';

export type AccountSyncResult =
  | { ok: true; subscriptions: SubscriptionRecord[] }
  /** `message: null` means the gateway is not reachable / not connected. */
  | { ok: false; message: string | null };

interface GatewayAccountItem {
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
}

/**
 * Pulls the account's subscriptions from the gateway and fills each one's server
 * list from its config (so the Servers screen has something to show).
 * A failing config fetch leaves that subscription with no servers; it never fails the sync.
 */
export async function fetchAccountSubscriptions(accessToken: string): Promise<AccountSyncResult> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch('/api/v1/subscriptions', { headers });
    const body = (await res.json().catch(() => ({}))) as {
      items?: GatewayAccountItem[];
      error?: { code?: string; message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        message: body.error?.message ? `${body.error.code ?? 'GATEWAY_ERROR'}: ${body.error.message}` : null,
      };
    }
    if (!Array.isArray(body.items)) {
      return { ok: true, subscriptions: [] };
    }

    const accountItems = body.items.filter(
      (item) => item.source === 'account' && typeof item.id === 'string',
    );

    const subscriptions = await Promise.all(
      accountItems.map(async (item): Promise<SubscriptionRecord> => {
        let endpoints: SubscriptionRecord['endpoints'] = [];
        try {
          const cfg = await fetch(`/api/v1/subscriptions/${encodeURIComponent(item.id!)}/config`, { headers });
          if (cfg.ok) {
            const payload = (await cfg.json()) as { rawLinks?: unknown };
            if (Array.isArray(payload.rawLinks)) {
              const joined = payload.rawLinks.filter((l): l is string => typeof l === 'string').join('\n');
              endpoints = parseSubscriptionPayload(joined).endpoints;
              registerEndpointLinks(item.id!, extractEndpointLinks(joined));
            }
          }
        } catch {
          // Keep the subscription; the server list can be refreshed later.
        }
        return {
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
          endpoints,
          lastSyncedAt: item.lastSyncedAt ?? new Date().toISOString(),
          renewalAvailable: Boolean(item.renewalInfo?.available),
        };
      }),
    );
    return { ok: true, subscriptions };
  } catch {
    return { ok: false, message: null };
  }
}
