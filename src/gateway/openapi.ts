export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'ASiS VPN Client API Gateway',
    version: '1.0.0',
    description:
      'End-user client API gateway bridging ASiS VPN mobile/desktop clients with existing PasarGuard and Reseller systems.',
  },
  servers: [{ url: '/api/v1', description: 'ASiS Client Gateway v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'category', 'message', 'diagnosticId'],
            properties: {
              code: { type: 'string' },
              category: { type: 'string' },
              message: { type: 'string' },
              diagnosticId: { type: 'string' },
              recoveryAction: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Gateway and upstream adapter readiness status',
        responses: { '200': { description: 'Health and adapter integration status' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate end-user via Reseller/PasarGuard adapter',
        responses: {
          '200': { description: 'Verified user session and tokens' },
          '401': { description: 'Invalid credentials' },
          '403': { description: 'Account suspended' },
          '503': { description: 'Upstream adapter not connected' },
        },
      },
    },
    '/auth/login-link': {
      post: {
        summary: 'Authenticate with a PasarGuard subscription link (no password)',
        responses: {
          '200': { description: 'Verified user session and tokens' },
          '400': { description: 'Link does not belong to a configured instance' },
          '401': { description: 'Panel rejected the link' },
          '403': { description: 'Account disabled' },
          '502': { description: 'PasarGuard panel unreachable' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token and issue fresh access token',
        responses: {
          '200': { description: 'Rotated token pair' },
          '401': { description: 'Refresh token expired, revoked, or reused' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke active device session',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Session revoked' } },
      },
    },
    '/auth/password-recovery': {
      post: {
        summary: 'Delegate password recovery to existing Reseller workflow',
        responses: {
          '200': { description: 'Recovery request delegated' },
          '503': { description: 'Reseller adapter not connected' },
        },
      },
    },
    '/user/me': {
      get: {
        summary: 'Get authenticated end-user account summary',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User account profile' } },
      },
    },
    '/subscriptions': {
      get: {
        summary: 'List account-synchronized and imported subscriptions',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated subscription list' } },
      },
    },
    '/subscriptions/import': {
      post: {
        summary: 'Validate and register manual subscription URL (SSRF-protected)',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Imported subscription registered' },
          '400': { description: 'Invalid or blocked URL' },
          '409': { description: 'Duplicate subscription URL' },
        },
      },
    },
    '/subscriptions/{id}': {
      get: {
        summary: 'Get subscription metadata',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Subscription details' } },
      },
      delete: {
        summary: 'Delete manually imported subscription',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Subscription deleted' } },
      },
    },
    '/subscriptions/{id}/config': {
      get: {
        summary: 'Get sanitized outbound nodes for subscription',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Normalized outbound configurations' } },
      },
    },
    '/subscriptions/{id}/refresh': {
      post: {
        summary: 'Refresh subscription metadata from upstream',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Updated subscription metadata' } },
      },
    },
    '/servers': {
      get: {
        summary: 'List normalized VPN servers with filters and pagination',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated server catalog' } },
      },
    },
    '/servers/{id}': {
      get: {
        summary: 'Get single server metadata',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Server details' } },
      },
    },
    '/servers/{id}/ping': {
      get: {
        summary: 'Gateway reachability probe (not tunnel RTT)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Probe measurement or unavailable' } },
      },
    },
    '/servers/probe': {
      post: {
        summary: 'SSRF-guarded batch TCP reachability probe for user server nodes',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Measured gateway TCP latencies per target' } },
      },
    },
    '/usage': {
      get: {
        summary: 'Get authoritative server-side subscription traffic usage and upload/download history',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'granularity',
            in: 'query',
            schema: { type: 'string', enum: ['24h', '7d', '30d'] },
          },
          {
            name: 'subscriptionId',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'Authoritative usage snapshot with history buckets' } },
      },
    },
    '/devices': {
      get: {
        summary: 'List registered user devices',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Device list' } },
      },
    },
    '/devices/revoke': {
      post: {
        summary: 'Revoke a device session by deviceId',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Device revoked' } },
      },
    },
    '/app/version': {
      get: {
        summary: 'Get minimum supported & latest client version metadata',
        responses: { '200': { description: 'Platform version policy' } },
      },
    },
    '/support': {
      get: {
        summary: 'Get backend-provided support contact and FAQs',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Support metadata' } },
      },
    },
  },
} as const;
