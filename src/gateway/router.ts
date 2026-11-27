import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { GatewayStore } from './adapters/gatewayStore.ts';
import { createGatewayStoreFromEnv } from './adapters/storeFactory.ts';
import {
  loadPasarGuardRegistryFromEnv,
  type PasarGuardAdapterRegistry,
} from './adapters/pasarguardAdapter.ts';
import { createAdminRouter } from './adminRoutes.ts';
import { authenticateLocalAccount, normalizeUsername, rejectUnknownUser } from './localAuth.ts';
import { loadResellerAdapterFromEnv, type ResellerAdapter } from './adapters/resellerAdapter.ts';
import { GatewayError } from './errors.ts';
import {
  authenticateWithLink,
  getLinkedContext,
  linksToServers,
  recordToCustomerStatus,
  recordToSubscription,
} from './linkedAccount.ts';
import { OPENAPI_SPEC } from './openapi.ts';
import {
  assertSafeProbeTarget,
  createRateLimiter,
  hashOpaqueSecret,
  measureTcpLatencyMs,
  signAccessToken,
  validateSubscriptionImportUrl,
  verifyAccessToken,
  type AccessTokenClaims,
} from './security.ts';
import type { AdapterHealthSummary, AppVersionInfo, RegisteredDevice } from './types.ts';

interface AuthenticatedRequest extends Request {
  auth?: AccessTokenClaims;
}

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : (val ?? '');
}

function getQueryString(req: Request, name: string): string {
  const val = req.query[name];
  return typeof val === 'string' ? val : '';
}

function parsePagination(req: Request): { page: number; limit: number } {
  const rawPage = Number(getQueryString(req, 'page') || '1');
  const rawLimit = Number(getQueryString(req, 'limit') || '25');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? Math.floor(rawLimit) : 25;
  return { page, limit };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
  }
  return 0;
}

export interface GatewayDependencies {
  pasarguard?: PasarGuardAdapterRegistry;
  reseller?: ResellerAdapter;
  store?: GatewayStore;
}

export function createGatewayRouter(deps: GatewayDependencies = {}) {
  const router = express.Router();
  const pasarguard = deps.pasarguard ?? loadPasarGuardRegistryFromEnv();
  const reseller = deps.reseller ?? loadResellerAdapterFromEnv();
  const store = deps.store ?? createGatewayStoreFromEnv();

  const authRateLimit = createRateLimiter('auth', 20, 60_000);
  const apiRateLimit = createRateLimiter('api', 120, 60_000);

  router.use(express.json({ limit: '64kb' }));
  router.use(apiRateLimit);
  router.use('/admin', createAdminRouter({ store, pasarguard }));

  const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(
        new GatewayError(
          401,
          'AUTH_MISSING_TOKEN',
          'authentication_failure',
          'Missing Bearer authorization token.',
          'reauthenticate',
        ),
      );
    }

    const token = header.slice('Bearer '.length).trim();
    try {
      const claims = verifyAccessToken(token);
      if (store.isDeviceRevoked(claims.sub, claims.deviceId)) {
        return next(
          new GatewayError(
            401,
            'AUTH_DEVICE_REVOKED',
            'session_expired',
            'This device session has been revoked.',
            'reauthenticate',
          ),
        );
      }
      req.auth = claims;
      next();
    } catch (err) {
      next(err);
    }
  };

  // Registers the device and issues the token pair (shared by password and link login).
  const startSession = (
    res: Response,
    rawDevice: Record<string, unknown>,
    deviceId: string,
    user: { customerId: string; username: string; status: string },
  ) => {
    const rawPlatform = rawDevice.platform;
    const platform: RegisteredDevice['platform'] =
      rawPlatform === 'android' || rawPlatform === 'ios' || rawPlatform === 'windows'
        ? rawPlatform
        : 'web';

    store.registerDevice(user.customerId, {
      deviceId,
      deviceName:
        typeof rawDevice.deviceName === 'string' && rawDevice.deviceName.trim()
          ? rawDevice.deviceName.trim().slice(0, 64)
          : 'Unknown Device',
      platform,
      appVersion:
        typeof rawDevice.appVersion === 'string' && rawDevice.appVersion.trim()
          ? rawDevice.appVersion.trim().slice(0, 24)
          : '0.3.0',
    });

    const access = signAccessToken({
      sub: user.customerId,
      username: user.username,
      deviceId,
    });
    const refresh = store.issueRefreshSession(user.customerId, user.username, deviceId);

    res.json({
      user: {
        id: user.customerId,
        username: user.username,
        status: user.status,
      },
      tokens: {
        accessToken: access.token,
        refreshToken: refresh.refreshToken,
        expiresAt: access.expiresAtMs,
        tokenType: 'Bearer',
      },
      deviceId,
      issuedAt: Date.now(),
    });
  };

  // --- Public Discovery & Health ---
  router.get('/openapi.json', (_req, res) => {
    res.json(OPENAPI_SPEC);
  });

  router.get('/health', async (_req, res, next) => {
    try {
      const primaryPg = pasarguard.getAdapter('primary');
      const defaultPg = pasarguard.getAdapter('default');
      const pgCheck = await (primaryPg.connectionState !== 'NOT_CONNECTED' ? primaryPg : defaultPg).verifyHealth();
      const resellerCheck = await reseller.verifyHealth();

      const summary: AdapterHealthSummary = {
        pasarguard: {
          status: pgCheck.status,
          configuredInstances: pasarguard.listSummaries().map(({ instanceId, label }) => ({
            instanceId,
            label,
          })),
          message: pgCheck.message,
        },
        reseller: {
          status: resellerCheck.status,
          message: resellerCheck.message,
        },
      };

      res.json({
        service: 'asis-client-gateway',
        apiVersion: 'v1',
        status: 'ready',
        timestamp: new Date().toISOString(),
        adapters: summary,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/app/version', (req, res) => {
    const rawPlatform = getQueryString(req, 'platform') || 'web';
    const platform: AppVersionInfo['platform'] =
      rawPlatform === 'android' || rawPlatform === 'ios' || rawPlatform === 'windows'
        ? rawPlatform
        : 'web';
    const currentVersion = getQueryString(req, 'currentVersion') || '0.3.0';
    const minimumSupportedVersion = process.env.ASIS_MIN_SUPPORTED_VERSION || '0.3.0';
    const latestVersion = process.env.ASIS_LATEST_VERSION || '0.3.0';

    const payload: AppVersionInfo = {
      platform,
      latestVersion,
      minimumSupportedVersion,
      mandatoryUpdate: compareSemver(currentVersion, minimumSupportedVersion) < 0,
      optionalUpdate: compareSemver(currentVersion, latestVersion) < 0,
      releaseNotes: 'ASiS VPN Gateway v1 contract baseline.',
      updateUrl: null,
      checksumSha256: null,
    };

    res.json(payload);
  });

  // Password login that ends in a PasarGuard link (gateway account or reseller answer): the panel is
  // the source of truth for status, servers and usage, exactly like link login.
  const startLinkedSession = async (
    res: Response,
    rawDevice: Record<string, unknown>,
    deviceId: string,
    subscriptionUrl: string,
  ) => {
    let linkedLogin: Awaited<ReturnType<typeof authenticateWithLink>>;
    try {
      linkedLogin = await authenticateWithLink(pasarguard, store, subscriptionUrl);
    } catch (err) {
      if (err instanceof GatewayError && err.code === 'AUTH_LINK_INVALID') {
        throw new GatewayError(
          502,
          'ACCOUNT_SUBSCRIPTION_MISMATCH',
          'backend_unavailable',
          'The stored subscription does not belong to a configured panel.',
          'contact_support',
        );
      }
      throw err;
    }
    const status = recordToCustomerStatus(linkedLogin.record);
    if (status === 'suspended') {
      throw new GatewayError(
        403,
        'AUTH_ACCOUNT_SUSPENDED',
        'account_suspended',
        'This account is suspended.',
        'contact_support',
      );
    }
    startSession(res, rawDevice, deviceId, {
      customerId: linkedLogin.userId,
      username: linkedLogin.record.username,
      status,
    });
  };

  // --- Authentication Routes ---
  router.post('/auth/login', authRateLimit, async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const rawDevice = (body?.device as Record<string, unknown> | undefined) ?? {};
      const deviceId =
        typeof rawDevice.deviceId === 'string' && rawDevice.deviceId.trim().length >= 4
          ? rawDevice.deviceId.trim()
          : '';

      if (!username || username.length < 3 || !password || password.length < 6 || !deviceId) {
        throw new GatewayError(
          400,
          'AUTH_VALIDATION_FAILED',
          'validation_error',
          'Valid username, password, and deviceId are required.',
          'verify_credentials',
        );
      }

      // 1) Accounts the gateway holds itself: password checked here, 3 wrong passwords lock it.
      const local = await authenticateLocalAccount(store, username, password);
      if (local) {
        await startLinkedSession(res, rawDevice, deviceId, local.subscriptionUrl);
        return;
      }

      // 2) Not a gateway account. With gateway accounts in use and no reseller configured,
      //    answer exactly like a wrong password (same cost, same message).
      if (reseller.connectionState !== 'CONNECTED' && store.countLocalAccounts() > 0) {
        await rejectUnknownUser(password);
      }

      // 3) Otherwise delegate strictly to the configured Reseller adapter (never fake a login when NOT_CONNECTED)
      const customer = await reseller.authenticateEndUser(username, password);
      if (customer.status === 'suspended') {
        throw new GatewayError(
          403,
          'AUTH_ACCOUNT_SUSPENDED',
          'account_suspended',
          'This account is suspended.',
          'contact_support',
        );
      }

      // The reseller hands back the customer's PasarGuard link: from here on this is a linked
      // account, so servers, usage and configs use the same pipeline as link login.
      if (customer.subscriptionUrl) {
        await startLinkedSession(res, rawDevice, deviceId, customer.subscriptionUrl);
        return;
      }

      startSession(res, rawDevice, deviceId, {
        customerId: customer.customerId,
        username: customer.username,
        status: customer.status,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login-link', authRateLimit, async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const link = typeof body?.link === 'string' ? body.link.trim() : '';
      const rawDevice = (body?.device as Record<string, unknown> | undefined) ?? {};
      const deviceId =
        typeof rawDevice.deviceId === 'string' && rawDevice.deviceId.trim().length >= 4
          ? rawDevice.deviceId.trim()
          : '';

      if (!link || link.length > 2048 || !deviceId) {
        throw new GatewayError(
          400,
          'AUTH_VALIDATION_FAILED',
          'validation_error',
          'A subscription link and deviceId are required.',
          'verify_credentials',
        );
      }

      const { userId, record } = await authenticateWithLink(pasarguard, store, link);
      if (recordToCustomerStatus(record) === 'suspended') {
        throw new GatewayError(
          403,
          'AUTH_ACCOUNT_SUSPENDED',
          'account_suspended',
          'This account is suspended.',
          'contact_support',
        );
      }

      startSession(res, rawDevice, deviceId, {
        customerId: userId,
        username: record.username,
        status: recordToCustomerStatus(record),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/refresh', authRateLimit, (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken.trim() : '';
      const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : '';

      if (!refreshToken || !deviceId) {
        throw new GatewayError(
          400,
          'AUTH_VALIDATION_FAILED',
          'validation_error',
          'refreshToken and deviceId are required.',
          'reauthenticate',
        );
      }

      const rotated = store.rotateRefreshToken(refreshToken, deviceId);
      if (!rotated) {
        throw new GatewayError(
          401,
          'AUTH_SESSION_EXPIRED',
          'session_expired',
          'Refresh token is invalid, expired, or revoked.',
          'reauthenticate',
        );
      }

      const access = signAccessToken({
        sub: rotated.session.userId,
        username: rotated.session.username,
        deviceId: rotated.session.deviceId,
      });

      res.json({
        tokens: {
          accessToken: access.token,
          refreshToken: rotated.refreshToken,
          expiresAt: access.expiresAtMs,
          tokenType: 'Bearer',
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.auth) {
      store.revokeDevice(req.auth.sub, req.auth.deviceId);
    }
    res.json({ loggedOut: true });
  });

  router.post('/auth/password-recovery', authRateLimit, async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      if (!username || username.length < 3) {
        throw new GatewayError(
          400,
          'VALIDATION_USERNAME_REQUIRED',
          'validation_error',
          'A valid username is required.',
          'verify_credentials',
        );
      }

      // Gateway-held accounts are reset by an admin; the answer never reveals whether the name exists.
      if (store.getLocalAccount(normalizeUsername(username)) || (reseller.connectionState !== 'CONNECTED' && store.countLocalAccounts() > 0)) {
        res.json({
          delegated: false,
          workflowMessage: 'Contact support or your reseller to reset the password or unlock the account.',
        });
        return;
      }

      const result = await reseller.requestPasswordRecovery(username);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // --- Authenticated User & Devices ---
  router.get('/user/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      const profile = linked
        ? await linked.fetchRecord().then((record) => ({
            customerId: req.auth!.sub,
            username: record.username,
            status: recordToCustomerStatus(record),
            allowedDevices: null,
          }))
        : await reseller.getCustomerProfile(req.auth!.username);
      res.json({
        user: profile,
        devicesCount: store.listDevices(req.auth!.sub, req.auth!.deviceId).length,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/devices', requireAuth, (req: AuthenticatedRequest, res) => {
    const devices = store.listDevices(req.auth!.sub, req.auth!.deviceId);
    res.json({ items: devices, total: devices.length });
  });

  router.post('/devices/revoke', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const targetDeviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : '';
      if (!targetDeviceId) {
        throw new GatewayError(
          400,
          'DEVICE_ID_REQUIRED',
          'validation_error',
          'deviceId is required.',
        );
      }

      const revoked = store.revokeDevice(req.auth!.sub, targetDeviceId);
      if (!revoked) {
        throw new GatewayError(404, 'DEVICE_NOT_FOUND', 'validation_error', 'Device not found.');
      }
      res.json({ revoked: true, deviceId: targetDeviceId });
    } catch (err) {
      next(err);
    }
  });

  // --- Subscriptions ---
  router.get('/subscriptions', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { page, limit } = parsePagination(req);
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      const linkedItems = linked
        ? [recordToSubscription(await linked.fetchRecord(), linked.account.instanceId)]
        : [];
      const services = linked ? [] : await reseller.getPurchasedServices(req.auth!.sub);
      const imported = store.listImportedSubscriptions(req.auth!.sub);
      const combined = [
        ...linkedItems,
        ...services.map((svc) => ({
          id: svc.serviceId,
          source: 'account' as const,
          providerInstanceId: svc.providerInstanceId,
          name: svc.name,
          type: svc.type,
          status: svc.status,
          totalBytes: svc.totalBytes,
          usedBytes: svc.usedBytes,
          remainingBytes:
            svc.totalBytes !== null ? Math.max(0, svc.totalBytes - svc.usedBytes) : null,
          startsAt: svc.startsAt,
          expiresAt: svc.expiresAt,
          allowedDevices: svc.allowedDevices,
          locations: [],
          lastSyncedAt: new Date().toISOString(),
          renewalInfo: { available: svc.renewalAvailable },
        })),
        ...imported,
      ];

      const start = (page - 1) * limit;
      res.json({
        items: combined.slice(start, start + limit),
        page,
        limit,
        total: combined.length,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/subscriptions/import', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
      const label =
        typeof body?.label === 'string' && body.label.trim()
          ? body.label.trim().slice(0, 64)
          : 'Imported Subscription';

      const validatedUrl = validateSubscriptionImportUrl(rawUrl);
      const urlHash = hashOpaqueSecret(validatedUrl.toString());
      const duplicate = store.findImportedDuplicate(req.auth!.sub, urlHash);

      if (duplicate) {
        throw new GatewayError(
          409,
          'SUBSCRIPTION_DUPLICATE',
          'invalid_configuration',
          'This subscription URL has already been imported.',
          'use_existing_subscription',
        );
      }

      const now = new Date().toISOString();
      const id = `imp_${crypto.randomBytes(8).toString('hex')}`;
      store.saveImportedSubscription({
        id,
        userId: req.auth!.sub,
        name: label,
        urlHash,
        sourceUrl: validatedUrl.toString(),
        createdAt: now,
        lastSyncedAt: now,
      });

      // Never return raw sourceUrl in response or logs
      res.status(201).json({
        id,
        source: 'manual_import',
        name: label,
        status: 'active',
        createdAt: now,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/subscriptions/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const subId = getParam(req, 'id');
      const imported = store.listImportedSubscriptions(req.auth!.sub).find((s) => s.id === subId);
      if (imported) {
        return res.json(imported);
      }
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      if (linked) {
        const account = recordToSubscription(await linked.fetchRecord(), linked.account.instanceId);
        if (account.id !== subId) {
          throw new GatewayError(404, 'SUBSCRIPTION_NOT_FOUND', 'validation_error', 'Subscription not found.');
        }
        return res.json(account);
      }
      const services = await reseller.getPurchasedServices(req.auth!.sub);
      const match = services.find((svc) => svc.serviceId === subId);
      if (!match) {
        throw new GatewayError(404, 'SUBSCRIPTION_NOT_FOUND', 'validation_error', 'Subscription not found.');
      }
      res.json(match);
    } catch (err) {
      next(err);
    }
  });

  router.get('/subscriptions/:id/config', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const subId = getParam(req, 'id');
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      if (linked) {
        return res.json({ subscriptionId: subId, ...(await linked.fetchLinks()) });
      }
      const instanceId = getQueryString(req, 'providerInstanceId') || 'default';
      const adapter = pasarguard.getAdapter(instanceId);
      const links = await adapter.getSubscriptionLinks(req.auth!.username);
      res.json({ subscriptionId: subId, ...links });
    } catch (err) {
      next(err);
    }
  });

  router.post('/subscriptions/:id/refresh', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const subId = getParam(req, 'id');
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      const instanceId = getQueryString(req, 'providerInstanceId') || 'default';
      const adapter = pasarguard.getAdapter(instanceId);
      const record = linked ? await linked.fetchRecord() : await adapter.getUserRecord(req.auth!.username);
      res.json({ subscriptionId: subId, refreshedAt: new Date().toISOString(), upstream: record });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/subscriptions/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const subId = getParam(req, 'id');
      const deleted = store.deleteImportedSubscription(req.auth!.sub, subId);
      if (!deleted) {
        throw new GatewayError(
          404,
          'SUBSCRIPTION_NOT_FOUND',
          'validation_error',
          'Imported subscription not found or cannot be deleted.',
        );
      }
      res.json({ deleted: true, id: subId });
    } catch (err) {
      next(err);
    }
  });

  // --- Servers, Usage & Support ---
  router.get('/servers', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      if (linked) {
        const { rawLinks } = await linked.fetchLinks();
        const items = linksToServers(rawLinks, `acct_${linked.account.instanceId}`);
        return res.json({ items, total: items.length });
      }
      const instanceId = getQueryString(req, 'providerInstanceId') || 'default';
      const adapter = pasarguard.getAdapter(instanceId);
      await adapter.getSubscriptionLinks(req.auth!.username);
      res.json({ items: [], total: 0 });
    } catch (err) {
      next(err);
    }
  });

  router.get('/servers/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const instanceId = getQueryString(req, 'providerInstanceId') || 'default';
      const adapter = pasarguard.getAdapter(instanceId);
      await adapter.getSubscriptionLinks(req.auth!.username);
      throw new GatewayError(404, 'SERVER_NOT_FOUND', 'server_unreachable', 'Server not found.');
    } catch (err) {
      next(err);
    }
  });

  router.get('/servers/:id/ping', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const instanceId = getQueryString(req, 'providerInstanceId') || 'default';
      const adapter = pasarguard.getAdapter(instanceId);
      await adapter.getSubscriptionLinks(req.auth!.username);
      res.json({ serverId: getParam(req, 'id'), latencyMs: null, available: false });
    } catch (err) {
      next(err);
    }
  });

  const probeRateLimit = createRateLimiter('probe', 30, 60_000);

  router.post('/servers/probe', requireAuth, probeRateLimit, async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = req.body as { targets?: Array<{ id?: unknown; host?: unknown; port?: unknown }> } | undefined;
      const rawTargets = Array.isArray(body?.targets) ? body.targets : null;
      if (!rawTargets || rawTargets.length === 0) {
        throw new GatewayError(
          400,
          'PROBE_TARGETS_REQUIRED',
          'validation_error',
          'At least one server target (id, host, port) is required.',
        );
      }
      if (rawTargets.length > 15) {
        throw new GatewayError(
          400,
          'PROBE_BATCH_TOO_LARGE',
          'validation_error',
          'A maximum of 15 servers can be probed per batch.',
        );
      }

      const results = await Promise.all(
        rawTargets.map(async (target) => {
          const id = typeof target?.id === 'string' ? target.id : 'unknown';
          try {
            const safe = await assertSafeProbeTarget(
              typeof target?.host === 'string' ? target.host : '',
              target?.port,
            );
            const measurement = await measureTcpLatencyMs(safe.host, safe.port);
            return { id, ...measurement };
          } catch (err) {
            return {
              id,
              latencyMs: null,
              available: false,
              error: err instanceof GatewayError ? err.code : 'PROBE_FAILED',
            };
          }
        }),
      );

      res.json({
        measurementSource: 'gateway_tcp_probe',
        measuredAt: new Date().toISOString(),
        results,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/usage', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const instanceId = getQueryString(req, 'providerInstanceId') || 'default';
      const subscriptionId = getQueryString(req, 'subscriptionId') || undefined;
      const rawGranularity = getQueryString(req, 'granularity');
      const granularity =
        rawGranularity === '24h' || rawGranularity === '30d' ? rawGranularity : '7d';
      const linked = getLinkedContext(pasarguard, store, req.auth!.sub);
      const adapter = pasarguard.getAdapter(instanceId);
      const record = linked ? await linked.fetchRecord() : await adapter.getUserRecord(req.auth!.username);
      const history = Array.isArray(record.usageHistory)
        ? record.usageHistory.map((bucket) => {
            const downloadBytes = Math.max(0, Number(bucket.downloadBytes) || 0);
            const uploadBytes = Math.max(0, Number(bucket.uploadBytes) || 0);
            return {
              timestamp: bucket.timestamp,
              downloadBytes,
              uploadBytes,
              totalBytes:
                typeof bucket.totalBytes === 'number' && Number.isFinite(bucket.totalBytes)
                  ? Math.max(0, bucket.totalBytes)
                  : downloadBytes + uploadBytes,
            };
          })
        : [];
      res.json({
        source: 'server_authoritative',
        subscriptionId,
        providerInstanceId: record.providerInstanceId,
        usedTrafficBytes: record.usedTrafficBytes,
        dataLimitBytes: record.dataLimitBytes,
        downloadTrafficBytes:
          typeof record.downloadTrafficBytes === 'number' ? record.downloadTrafficBytes : null,
        uploadTrafficBytes:
          typeof record.uploadTrafficBytes === 'number' ? record.uploadTrafficBytes : null,
        expiresAt: record.expiresAt,
        recordedAt: new Date().toISOString(),
        granularity,
        history,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/support', requireAuth, async (_req, res, next) => {
    try {
      const resellerHealth = await reseller.verifyHealth();
      res.json({
        integrationStatus: resellerHealth.status,
        contactEmail: null,
        supportPortalUrl: null,
        faqs: [],
        ticketEndpointAvailable: false,
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Unknown API routes ---
  router.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new GatewayError(404, 'ROUTE_NOT_FOUND', 'validation_error', 'Unknown API route.'));
  });

  // --- Centralized Error Envelope Handler ---
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GatewayError) {
      return res.status(err.statusCode).json(err.toEnvelope());
    }

    // body-parser errors (malformed JSON, oversized body) are client errors, not 500s.
    const parserType = (err as { type?: string } | null)?.type;
    if (parserType === 'entity.too.large') {
      const tooLarge = new GatewayError(413, 'REQUEST_TOO_LARGE', 'validation_error', 'Request body is too large.');
      return res.status(413).json(tooLarge.toEnvelope());
    }
    if (parserType === 'entity.parse.failed' || parserType === 'encoding.unsupported') {
      const badBody = new GatewayError(400, 'REQUEST_BODY_INVALID', 'validation_error', 'Request body is not valid JSON.');
      return res.status(400).json(badBody.toEnvelope());
    }

    const fallback = new GatewayError(
      500,
      'GATEWAY_INTERNAL_ERROR',
      'backend_unavailable',
      'Unexpected gateway error.',
      'retry_request',
    );
    // Log server-side only; the client receives just the diagnosticId.
    console.error(`[gateway] ${fallback.diagnosticId}`, err instanceof Error ? err.message : err);
    return res.status(500).json(fallback.toEnvelope());
  });

  return router;
}
