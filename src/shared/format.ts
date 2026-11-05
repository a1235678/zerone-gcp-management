export const formatDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '/');
export const formatNumber = (n: number) => n.toLocaleString('zh-TW');
export const formatDateTime = (s: string) => s.replace(/-/g, '/');
export const formatUsd = (cents: number, digits = 2) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const formatPct = (pct: number) => `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`;
