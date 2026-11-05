import type { Schedule } from '../types';

// 欄位名稱待與 Terry 的 API 對照（待確認 #9）
export const schedules: Schedule[] = [
  s('J001', 'once', 'addSeats', 'waiting', '2026-11-10 00:00', 'C0016', 'S017', '增加 6 席（64 → 70）', '黃柏翰'),
  s('J002', 'once', 'renew', 'waiting', '2026-11-14 00:00', 'C0019', 'S020', '續約 12 個月', '黃柏翰'),
  s('J003', 'once', 'renew', 'waiting', '2026-11-19 00:00', 'C0002', 'S002', '續約 12 個月', '黃柏翰'),
  s('J004', 'once', 'renew', 'waiting', '2026-11-27 00:00', 'C0005', 'S006', '續約 12 個月', '李冠霖'),
  s('J005', 'monthly', 'sync', 'waiting', '2026-12-01 06:00', 'C0011', 'S012', '每月同步訂閱與授權指派', '張家銘'),
  s('J006', 'monthly', 'sync', 'running', '2026-11-05 06:00', 'C0024', 'S025', '每月同步訂閱與授權指派', '張家銘'),
  s('J007', 'once', 'removeSeats', 'failed', '2026-11-03 16:00', 'C0006', 'S007', '減少 10 席（130 → 120）', '黃柏翰'),
  s('J008', 'once', 'addSeats', 'done', '2026-11-04 10:30', 'C0008', 'S009', '增加 5 席（70 → 75）', '黃柏翰'),
  s('J009', 'once', 'addSeats', 'done', '2026-10-28 14:30', 'C0011', 'S012', '增加 10 席（200 → 210）', '黃柏翰'),
  s('J010', 'once', 'cancel', 'done', '2026-10-30 10:30', 'C0015', 'S016', '取消訂閱', '黃柏翰'),
  s('J011', 'once', 'renew', 'failed', '2026-10-15 11:00', 'C0010', 'S011', '續約 12 個月', '黃柏翰'),
  s('J012', 'yearly', 'renew', 'waiting', '2027-03-01 00:00', 'C0024', 'S025', '每年自動續約', '王雅琪'),
  s('J013', 'yearly', 'renew', 'waiting', '2027-05-19 00:00', 'C0003', 'S004', '每年自動續約', '王雅琪'),
  s('J014', 'once', 'addSeats', 'cancelled', '2026-10-25 00:00', 'C0014', 'S015', '增加 4 席（客戶撤回）', '李冠霖'),
  s('J015', 'monthly', 'sync', 'done', '2026-11-01 06:00', 'C0011', 'S012', '每月同步訂閱與授權指派', '張家銘'),
  s('J016', 'once', 'addSeats', 'waiting', '2026-11-08 00:00', 'C0012', 'S013', '增加 2 席（6 → 8）', '黃柏翰'),
];

function s(
  id: string,
  kind: Schedule['kind'],
  action: Schedule['action'],
  status: Schedule['status'],
  enabledAt: string,
  customerId: string,
  subscriptionId: string,
  detail: string,
  createdBy: string,
): Schedule {
  return { id, kind, action, status, enabledAt, customerId, subscriptionId, detail, createdBy };
}
