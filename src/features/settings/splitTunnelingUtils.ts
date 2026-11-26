import type {
  InstalledAppCategory,
  InstalledAppEntry,
  SplitTunnelingRuleMode,
} from '../../engine/types.ts';

export type AppListFilterMode = 'all' | 'vpn' | 'bypassed';

export function isAppRoutedThroughVpn(
  appId: string,
  ruleMode: SplitTunnelingRuleMode,
  selectedAppIds: string[],
): boolean {
  const inList = selectedAppIds.includes(appId);
  return ruleMode === 'exclude_selected' ? !inList : inList;
}

export function toggleAppVpnAccess(
  appId: string,
  enableVpn: boolean,
  ruleMode: SplitTunnelingRuleMode,
  selectedAppIds: string[],
): string[] {
  const shouldBeInList = ruleMode === 'exclude_selected' ? !enableVpn : enableVpn;
  const set = new Set(selectedAppIds);
  if (shouldBeInList) {
    set.add(appId);
  } else {
    set.delete(appId);
  }
  return Array.from(set);
}

export function setAllAppsVpnAccess(
  apps: InstalledAppEntry[],
  enableVpn: boolean,
  ruleMode: SplitTunnelingRuleMode,
  currentSelectedIds: string[],
): string[] {
  const set = new Set(currentSelectedIds);
  const shouldBeInList = ruleMode === 'exclude_selected' ? !enableVpn : enableVpn;
  for (const app of apps) {
    if (shouldBeInList) {
      set.add(app.id);
    } else {
      set.delete(app.id);
    }
  }
  return Array.from(set);
}

export function filterInstalledApps(
  apps: InstalledAppEntry[],
  options: {
    query: string;
    filterMode: AppListFilterMode;
    categoryFilter?: InstalledAppCategory | 'all';
    showSystemApps: boolean;
    ruleMode: SplitTunnelingRuleMode;
    selectedAppIds: string[];
  },
): InstalledAppEntry[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  return apps.filter((app) => {
    if (!options.showSystemApps && app.isSystemApp) {
      return false;
    }

    if (options.categoryFilter && options.categoryFilter !== 'all' && app.category !== options.categoryFilter) {
      return false;
    }

    if (normalizedQuery) {
      const nameMatch = app.name.toLowerCase().includes(normalizedQuery);
      const idMatch = app.identifier.toLowerCase().includes(normalizedQuery);
      if (!nameMatch && !idMatch) {
        return false;
      }
    }

    if (options.filterMode !== 'all') {
      const vpnEnabled = isAppRoutedThroughVpn(
        app.id,
        options.ruleMode,
        options.selectedAppIds,
      );
      if (options.filterMode === 'vpn' && !vpnEnabled) {
        return false;
      }
      if (options.filterMode === 'bypassed' && vpnEnabled) {
        return false;
      }
    }

    return true;
  });
}

export function validateCustomAppRule(
  rawName: string,
  rawIdentifier: string,
  category: InstalledAppCategory,
): {
  valid: boolean;
  errorCode?: 'NAME_REQUIRED' | 'IDENTIFIER_REQUIRED' | 'IDENTIFIER_INVALID';
  entry?: InstalledAppEntry;
} {
  const name = rawName.trim();
  const identifier = rawIdentifier.trim();

  if (!name || name.length < 2) {
    return { valid: false, errorCode: 'NAME_REQUIRED' };
  }

  if (!identifier || identifier.length < 2) {
    return { valid: false, errorCode: 'IDENTIFIER_REQUIRED' };
  }

  // Allow reverse-DNS Android/iOS package IDs (com.example.app) or Windows/Linux executables (chrome.exe, app-bin)
  const validIdentifier = /^[a-zA-Z0-9._-]{2,128}$/.test(identifier);
  if (!validIdentifier || identifier.includes('..')) {
    return { valid: false, errorCode: 'IDENTIFIER_INVALID' };
  }

  const normalizedId = identifier.toLowerCase();
  return {
    valid: true,
    entry: {
      id: normalizedId,
      name: name.slice(0, 64),
      identifier,
      category,
      isSystemApp: category === 'system',
      source: 'custom_entry',
    },
  };
}
