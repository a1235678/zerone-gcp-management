import { gwsSkus } from './offers';
import type { OfferSnapshot, Subscription } from '../types';

// GWS 訂閱。status 只存「已取消」；「使用中／即將到期」由資料層依到期日計算（30 天內為即將到期）。
// 席次已反映「已完成」的執行單結果，例如 WO-1104-003 把 S009 調到 75 席。
type Seed = [id: string, customerId: string, plan: string, seats: number, expiresAt: string, cancelled?: boolean, lastSyncedAt?: string];

const seeds: Seed[] = [
  ['S001', 'C0001', 'Business Starter', 8, '2027-03-11'],
  ['S002', 'C0002', 'Business Standard', 45, '2026-11-20'],
  ['S003', 'C0002', 'Business Starter', 8, '2027-02-10'],
  ['S004', 'C0003', 'Business Standard', 32, '2027-05-19'],
  ['S005', 'C0004', 'Business Plus', 18, '2027-06-07'],
  ['S006', 'C0005', 'Business Standard', 60, '2026-11-28'],
  ['S007', 'C0006', 'Business Starter', 130, '2027-07-31'],
  ['S008', 'C0007', 'Business Standard', 25, '2027-08-21'],
  ['S009', 'C0008', 'Business Plus', 75, '2027-09-09'],
  ['S010', 'C0009', 'Business Starter', 12, '2026-10-02', true],
  ['S011', 'C0010', 'Business Standard', 15, '2026-12-01', false, '2026-11-04 06:00'],
  ['S012', 'C0011', 'Enterprise Standard', 210, '2027-11-13'],
  ['S013', 'C0012', 'Business Starter', 6, '2027-12-04'],
  ['S014', 'C0013', 'Business Standard', 14, '2027-01-08'],
  ['S015', 'C0014', 'Business Standard', 38, '2027-02-16'],
  ['S016', 'C0015', 'Business Standard', 22, '2026-10-30', true],
  ['S017', 'C0016', 'Business Plus', 64, '2027-04-20'],
  ['S018', 'C0017', 'Business Starter', 20, '2027-05-29'],
  ['S019', 'C0018', 'Business Starter', 10, '2027-06-17'],
  ['S020', 'C0019', 'Business Standard', 16, '2026-11-15'],
  ['S021', 'C0020', 'Business Plus', 28, '2027-08-24'],
  ['S022', 'C0021', 'Business Standard', 42, '2027-09-11'],
  ['S023', 'C0022', 'Business Starter', 9, '2027-10-29'],
  ['S024', 'C0023', 'Business Standard', 11, '2027-01-13'],
  ['S025', 'C0024', 'Enterprise Standard', 150, '2027-03-01'],
  ['S026', 'C0024', 'Business Starter', 20, '2027-03-01'],
  ['S027', 'C0025', 'Business Starter', 5, '2027-06-18'],
];

/** 示意資料：下單時存下的方案快照 */
const offerFor = (plan: string, planType: 'annual' | 'flexible', fetchedAt: string): OfferSnapshot | undefined => {
  const sku = gwsSkus.find((k) => k.version === plan);
  const offer = sku?.offers.find((o) => o.planType === planType && o.billing === 'monthly' && !o.availableUntil);
  return sku && offer ? { ...offer, skuId: sku.skuId, skuName: sku.name, version: plan, fetchedAt: `${fetchedAt} 15:40` } : undefined;
};

export const subscriptions: Subscription[] = seeds.map(([id, customerId, plan, seats, expiresAt, cancelled, lastSyncedAt]) => ({
  id,
  customerId,
  product: 'GWS',
  plan,
  seats,
  status: cancelled ? 'cancelled' : 'active',
  startsAt: contractStart(expiresAt),
  expiresAt,
  // 合約時間（GMT+0）：大多是 16:00（GMT+8）生效，也就是 08:00 GMT+0
  contractTime: ['S004', 'S011'].includes(id) ? '02:30' : '08:00',
  // 彈性合約（Flexible）：可以取消續約排程
  term: ['S012', 'S020'].includes(id) ? 'flexible' : 'annual',
  // 目前使用的 Google 方案：彈性合約用彈性方案，其他用年約（每月計費）
  offer: offerFor(plan, ['S012', 'S020'].includes(id) ? 'flexible' : 'annual', contractStart(expiresAt)),
  lastOrder: lastOrderFor(id, plan, seats, contractStart(expiresAt), ['S012', 'S020'].includes(id)),
  lastSyncedAt: lastSyncedAt ?? '2026-11-05 06:00',
}));

/**
 * 示意資料：上次向原廠（Google）下單（新訂或續約）的席次與金額。
 * 年約算一年（月費 × 12），彈性方案算一個月。幾筆示意「之後又加購」，所以上次購買的席次比目前少。
 */
function lastOrderFor(id: string, plan: string, seats: number, startsAt: string, flexible: boolean): Subscription['lastOrder'] {
  const added: Record<string, number> = { S002: 5, S006: 10, S011: 3, S025: 20 };
  const lastSeats = seats - (added[id] ?? 0);
  const monthly = offerFor(plan, flexible ? 'flexible' : 'annual', startsAt)?.priceCents ?? 0;
  const firstYear = ['S024', 'S027'].includes(id);
  return { type: firstYear ? 'new' : 'renewal', orderedAt: startsAt, seats: lastSeats, amountCents: lastSeats * monthly * (flexible ? 1 : 12) };
}

/**
 * GWS 訂閱主檔裡、還沒掛到任何客戶的網域（從 Google 同步回來，例如客戶先前自己向 Google 購買）。
 * 客戶主檔「綁定已開通 GWS 的網域」時，網域必須在 GWS 訂閱主檔裡。
 */
export const unlinkedGwsDomains = ['hefeng-shop.example', 'galaxy-esports.example', 'oneleaf-cafe.example'];

// 示意：客戶表示合約到期後不再續約
subscriptions.find((s) => s.id === 'S014')!.renewalCancelled = { at: '2026-11-03 15:20', by: '李冠霖', note: '客戶改用其他方案，到期後不續約' };

/** 假資料的合約都是一年：迄日往前推一年再加一天 */
function contractStart(expiresAt: string) {
  const d = new Date(`${expiresAt}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
