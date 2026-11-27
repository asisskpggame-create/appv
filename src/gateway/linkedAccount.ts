import type { GatewayStore } from './adapters/gatewayStore.ts';
import type { PasarGuardAdapter, PasarGuardAdapterRegistry } from './adapters/pasarguardAdapter.ts';
import { GatewayError } from './errors.ts';
import type {
  LinkedAccount,
  NormalizedServer,
  NormalizedSubscription,
  PasarGuardSubscriptionPayload,
  PasarGuardUserRecord,
} from './types.ts';

/** Stable gateway user id for a PasarGuard account (also the JWT `sub`). */
export function linkedUserId(instanceId: string, username: string): string {
  return `pg:${instanceId}:${username}`;
}

function invalidLink(): GatewayError {
  return new GatewayError(
    400,
    'AUTH_LINK_INVALID',
    'validation_error',
    'This is not a valid subscription link for this service.',
    'verify_credentials',
  );
}

/**
 * Login with a pasted subscription link. The link must match a configured
 * instance; the panel itself proves the account exists. The token is stored
 * server-side so later calls can read usage and configs.
 */
export async function authenticateWithLink(
  registry: PasarGuardAdapterRegistry,
  store: GatewayStore,
  rawLink: string,
): Promise<{ userId: string; record: PasarGuardUserRecord }> {
  const match = registry.findForLink(rawLink);
  if (!match || !match.adapter.fetchSubscriptionInfo) throw invalidLink();

  const record = await match.adapter.fetchSubscriptionInfo(match.token);
  const userId = linkedUserId(match.adapter.instanceId, record.username);
  store.saveLinkedAccount(userId, {
    instanceId: match.adapter.instanceId,
    username: record.username,
    subscriptionToken: match.token,
  });
  return { userId, record };
}

export interface LinkedContext {
  account: LinkedAccount;
  adapter: PasarGuardAdapter;
  fetchRecord(): Promise<PasarGuardUserRecord>;
  fetchLinks(): Promise<PasarGuardSubscriptionPayload>;
}

/** Returns a context when this user logged in through a subscription link, else null. */
export function getLinkedContext(
  registry: PasarGuardAdapterRegistry,
  store: GatewayStore,
  userId: string,
): LinkedContext | null {
  const account = store.getLinkedAccount(userId);
  if (!account) return null;
  const adapter = registry.getAdapter(account.instanceId);
  if (!adapter.fetchSubscriptionInfo || !adapter.fetchSubscriptionLinks) {
    throw new GatewayError(
      503,
      'PASARGUARD_NOT_CONNECTED',
      'backend_unavailable',
      'The PasarGuard instance for this account is not configured.',
      'configure_pasarguard_adapter',
    );
  }
  return {
    account,
    adapter,
    fetchRecord: () => adapter.fetchSubscriptionInfo!(account.subscriptionToken),
    fetchLinks: () => adapter.fetchSubscriptionLinks!(account.subscriptionToken),
  };
}

export function recordToCustomerStatus(record: PasarGuardUserRecord): 'active' | 'suspended' {
  return record.status === 'disabled' ? 'suspended' : 'active';
}

export function recordToSubscription(record: PasarGuardUserRecord, instanceId: string): NormalizedSubscription {
  const hasLimit = record.dataLimitBytes !== null;
  const hasExpiry = record.expiresAt !== null;
  const status: NormalizedSubscription['status'] =
    record.status === 'expired'
      ? 'expired'
      : record.status === 'limited'
        ? 'exhausted'
        : record.status === 'disabled'
          ? 'suspended'
          : 'active';
  return {
    id: `acct_${instanceId}`,
    source: 'account',
    providerInstanceId: instanceId,
    name: record.username,
    type: hasLimit && hasExpiry ? 'combined' : hasLimit ? 'traffic' : hasExpiry ? 'time' : 'unlimited',
    status,
    totalBytes: record.dataLimitBytes,
    usedBytes: record.usedTrafficBytes,
    remainingBytes: hasLimit ? Math.max(0, (record.dataLimitBytes as number) - record.usedTrafficBytes) : null,
    startsAt: record.createdAt ?? null,
    expiresAt: record.expiresAt,
    allowedDevices: null,
    locations: [],
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Light server list from raw URI links: name (fragment), protocol (scheme), no
 * hosts/credentials. Country and live probe data are unknown here, so they stay
 * empty/null instead of being guessed.
 */
export function linksToServers(rawLinks: string[], subscriptionId: string): NormalizedServer[] {
  return rawLinks.map((link, index) => {
    const scheme = link.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase() ?? 'unknown';
    let name = '';
    const hash = link.indexOf('#');
    if (hash >= 0) {
      try {
        name = decodeURIComponent(link.slice(hash + 1)).trim();
      } catch {
        name = '';
      }
    }
    return {
      id: `${subscriptionId}:${index}`,
      subscriptionId,
      name: name || `${scheme.toUpperCase()} Node ${index + 1}`,
      countryCode: '',
      countryName: '',
      city: '',
      protocols: [scheme],
      group: subscriptionId,
      available: true,
      gatewayProbeLatencyMs: null,
    };
  });
}
