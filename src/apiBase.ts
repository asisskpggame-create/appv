// Inside the native shell the origin is https://localhost, so relative
// /api/... calls must be pointed at the real gateway.
const base = String((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
if (base && typeof window !== 'undefined') {
  const orig = window.fetch.bind(window);
  window.fetch = ((input: any, init?: any) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return orig(base + input, init);
    }
    return orig(input, init);
  }) as typeof window.fetch;
}
export {};
