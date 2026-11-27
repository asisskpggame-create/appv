import { InMemoryGatewayStore, type GatewayStore } from './gatewayStore.ts';
import { SqliteGatewayStore } from './sqliteGatewayStore.ts';

/**
 * ASIS_DB_PATH set  -> persistent SQLite store (sessions survive restarts).
 * ASIS_DB_PATH unset -> in-memory store (everything is lost on restart).
 */
export function createGatewayStoreFromEnv(env: NodeJS.ProcessEnv = process.env): GatewayStore {
  const dbPath = env.ASIS_DB_PATH?.trim();
  if (dbPath) {
    return new SqliteGatewayStore(dbPath, env);
  }
  if (env.NODE_ENV === 'production') {
    console.warn('[store] ASIS_DB_PATH not set: sessions and devices are in memory and reset on every restart.');
  }
  return new InMemoryGatewayStore();
}
