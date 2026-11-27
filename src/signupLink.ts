// Where "Create an account" leads. Accounts are not created inside the app (the operator or the sales
// bot creates them), so the link is only shown when the operator sets VITE_SIGNUP_URL at build time.

/** Returns the URL when it is a plain https link without embedded credentials, else null. */
export function parseSignupUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const SIGNUP_URL: string | null = parseSignupUrl((import.meta as any).env?.VITE_SIGNUP_URL);
