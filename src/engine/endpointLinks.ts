/**
 * In-memory store of the full connection link of each server (the ones that
 * carry the UUID / password). The server catalog only keeps a redacted host,
 * so this is what the Connect button reads to build the real outbound.
 *
 * Deliberately NOT persisted: no localStorage, no disk. After an app restart the
 * links come back from the gateway during account sync.
 */
const links = new Map<string, string>();

/** `serverId` is the catalog id: `${subscriptionId}:${endpointId}`. */
export function registerEndpointLinks(
  subscriptionId: string,
  linksByEndpointId: Record<string, string>,
): void {
  clearEndpointLinks(subscriptionId);
  for (const [endpointId, link] of Object.entries(linksByEndpointId)) {
    links.set(`${subscriptionId}:${endpointId}`, link);
  }
}

export function getEndpointLink(serverId: string): string | null {
  return links.get(serverId) ?? null;
}

/** Without an argument everything is dropped (sign-out). */
export function clearEndpointLinks(subscriptionId?: string): void {
  if (!subscriptionId) {
    links.clear();
    return;
  }
  const prefix = `${subscriptionId}:`;
  for (const key of Array.from(links.keys())) {
    if (key.startsWith(prefix)) links.delete(key);
  }
}
