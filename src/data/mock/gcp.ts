// GCP 用量假資料：以固定亂數種子產生，每次載入都一樣。
// 每日費用、客戶小計、總計都由同一份「每客戶每日費用（美分）」加總，確保前後一致。

export const GCP_PERIOD_END = '2026-11-05';
export const GCP_DAYS = 30;

interface GcpSeed {
  customerId: string;
  projects: number;
  /** 平均每日費用（USD） */
  dailyUsd: number;
  egressGb: number;
  /** 較前期變化（%），用來回推前期費用 */
  changePct: number;
}

const seeds: GcpSeed[] = [
  { customerId: 'C0011', projects: 12, dailyUsd: 186, egressGb: 4120, changePct: 8.4 },
  { customerId: 'C0024', projects: 9, dailyUsd: 142, egressGb: 2875, changePct: 12.1 },
  { customerId: 'C0008', projects: 7, dailyUsd: 118, egressGb: 6930, changePct: 21.6 },
  { customerId: 'C0006', projects: 5, dailyUsd: 64, egressGb: 980, changePct: -4.2 },
  { customerId: 'C0016', projects: 4, dailyUsd: 41, egressGb: 412, changePct: 2.9 },
  { customerId: 'C0020', projects: 3, dailyUsd: 37, egressGb: 1540, changePct: -11.3 },
  { customerId: 'C0003', projects: 2, dailyUsd: 18, egressGb: 126, changePct: 0.8 },
  { customerId: 'C0007', projects: 3, dailyUsd: 22, egressGb: 88, changePct: 35.5 },
  { customerId: 'C0022', projects: 1, dailyUsd: 6, egressGb: 14, changePct: -2.0 },
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gcpDates(): string[] {
  const end = new Date(`${GCP_PERIOD_END}T00:00:00Z`);
  return Array.from({ length: GCP_DAYS }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (GCP_DAYS - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export interface GcpAccountUsage {
  customerId: string;
  projects: number;
  egressGb: number;
  dailyCents: number[];
  prevPeriodCents: number;
}

export const gcpAccounts: GcpAccountUsage[] = (() => {
  const rand = mulberry32(20261105);
  const dates = gcpDates();
  return seeds.map((s) => {
    const dailyCents = dates.map((date, i) => {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weekend = dow === 0 || dow === 6 ? 0.78 : 1;
      // 讓整段期間有緩慢趨勢，符合「較前期變化」的方向
      const trend = 1 + (s.changePct / 100) * ((i - GCP_DAYS / 2) / GCP_DAYS);
      const noise = 0.88 + rand() * 0.24;
      return Math.round(s.dailyUsd * 100 * weekend * trend * noise);
    });
    const total = dailyCents.reduce((a, b) => a + b, 0);
    return {
      customerId: s.customerId,
      projects: s.projects,
      egressGb: s.egressGb,
      dailyCents,
      prevPeriodCents: Math.round(total / (1 + s.changePct / 100)),
    };
  });
})();
