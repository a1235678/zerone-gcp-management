export const formatDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '/');
export const formatNumber = (n: number) => n.toLocaleString('zh-TW');
export const formatDateTime = (s: string) => s.replace(/-/g, '/');
/** 合約日期加上時、分（GMT+0），例如 2026/11/05 08:00 */
export const formatContractAt = (date: string, time = '00:00') => `${formatDate(date)} ${time}`;
/** 合約期間：2025/11/05 08:00 – 2026/11/04 08:00（GMT+0） */
export const formatContractPeriod = (start: string, end: string, time = '00:00') => `${formatContractAt(start, time)} – ${formatContractAt(end, time)}（GMT+0）`;
// 角色看不到價格時，金額一律以「••••」顯示（2026/11/24）。登入後由畫面設定；真正的限制要在後端不回傳金額
let priceVisible = true;
export const setPriceVisible = (v: boolean) => {
  priceVisible = v;
};
export const isPriceVisible = () => priceVisible;
export const HIDDEN_PRICE = '••••';
export const formatUsd = (cents: number, digits = 2) =>
  priceVisible ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : HIDDEN_PRICE;
export const formatPct = (pct: number) => `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`;
