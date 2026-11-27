import type { NextFunction, Request, Response } from 'express';

/**
 * CORS for the packaged apps. The Capacitor Android shell loads the UI from
 * https://localhost (androidScheme "https"), so its calls to the gateway are
 * cross-origin. Auth uses Bearer tokens (no cookies), hence no credentials.
 *
 * Extra origins: ASIS_ALLOWED_ORIGINS (comma separated), e.g. a web client URL.
 */
const DEFAULT_ORIGINS = [
  'https://localhost', // Capacitor Android (androidScheme: https)
  'http://localhost', // Capacitor Android (http scheme)
  'capacitor://localhost', // Capacitor iOS
];

export function loadAllowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const extra = (env.ASIS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

export function createCorsMiddleware(allowed: Set<string> = loadAllowedOrigins()) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');

    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      // Preflight: answer here, never forward to the router.
      res.statusCode = origin && allowed.has(origin) ? 204 : 403;
      res.end();
      return;
    }
    next();
  };
}
