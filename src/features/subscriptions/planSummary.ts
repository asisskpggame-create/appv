// "700 GB | 180 Days" line for a plan, built only from data the panel really gave us.
// Nothing is invented: no size (or unlimited) and no valid start/end dates -> that part is left out.

const GIB = 1024 ** 3;
const DAY_MS = 86_400_000;

export interface PlanSummaryInput {
  totalBytes: number | null;
  startsAt: string | null;
  expiresAt: string | null;
}

export function planSummary(sub: PlanSummaryInput): string | null {
  const parts: string[] = [];
  if (sub.totalBytes !== null && Number.isFinite(sub.totalBytes) && sub.totalBytes > 0) {
    const gb = sub.totalBytes / GIB;
    const text = Number.isInteger(gb) || gb >= 100 ? String(Math.round(gb)) : gb.toFixed(1).replace(/\.0$/, '');
    parts.push(`${text} GB`);
  }
  const start = sub.startsAt ? Date.parse(sub.startsAt) : NaN;
  const end = sub.expiresAt ? Date.parse(sub.expiresAt) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const days = Math.round((end - start) / DAY_MS);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
  }
  return parts.length ? parts.join(' | ') : null;
}
