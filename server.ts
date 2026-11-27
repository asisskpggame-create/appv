import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGatewayRouter } from './src/gateway/router.ts';
import { createCorsMiddleware } from './src/gateway/cors.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Baseline security headers (no extra dependency).
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (IS_PRODUCTION) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Allow the packaged apps (Capacitor origin https://localhost) to call the API.
  app.use('/api', createCorsMiddleware());

  // Never cache API responses (tokens, usage, subscription data).
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Mount ASiS Client API Gateway v1
  app.use('/api/v1', createGatewayRouter());

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASiS VPN server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ASiS VPN server:', err);
  process.exit(1);
});
