import type { Subscription } from '../types';

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

export const subscriptions: Subscription[] = seeds.map(([id, customerId, plan, seats, expiresAt, cancelled, lastSyncedAt]) => ({
  id,
  customerId,
  product: 'GWS',
  plan,
  seats,
  status: cancelled ? 'cancelled' : 'active',
  expiresAt,
  lastSyncedAt: lastSyncedAt ?? '2026-11-05 06:00',
}));

/** 新訂閱可選的方案（之後應由 API 提供，見待確認 #3） */
export const gwsPlans = ['Business Starter', 'Business Standard', 'Business Plus', 'Enterprise Standard'];
