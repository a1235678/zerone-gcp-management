import type { Schedule } from '../types';

// 欄位名稱待與 Terry 的 API 對照（待確認 #9）。有 operationId 的是由訂單操作（排程執行）建立的。
export const schedules: Schedule[] = [
  s('J001', 'once', 'addSeats', 'waiting', '2026-11-10 00:00', 'C0016', 'S017', '加購 6 席（64 → 70）', '何佩真'),
  s('J002', 'once', 'renew', 'waiting', '2026-11-16 00:00', 'C0019', 'S020', 'Business Standard 16 席，續約 12 個月', '何佩真'),
  s('J003', 'once', 'renew', 'waiting', '2026-11-21 00:00', 'C0002', 'S002', 'Business Standard 45 席 → Business Standard 50 席，續約 12 個月', '何佩真', 'OP-1104-002'),
  s('J004', 'once', 'renew', 'waiting', '2026-11-29 00:00', 'C0005', 'S006', 'Business Standard 60 席，續約 12 個月', '何佩真'),
  s('J005', 'monthly', 'sync', 'waiting', '2026-12-01 06:00', 'C0011', 'S012', '每月同步訂閱與授權指派', '張家銘'),
  s('J006', 'monthly', 'sync', 'running', '2026-11-05 06:00', 'C0024', 'S025', '每月同步訂閱與授權指派', '張家銘'),
  s('J007', 'once', 'addSeats', 'failed', '2026-11-03 00:00', 'C0006', 'S007', '加購 10 席（130 → 140）', '何佩真', 'OP-1103-001'),
  s('J008', 'once', 'addSeats', 'done', '2026-11-04 00:00', 'C0008', 'S009', '加購 5 席（70 → 75）', '何佩真', 'OP-1104-001'),
  s('J009', 'once', 'addSeats', 'done', '2026-10-28 00:00', 'C0011', 'S012', '加購 10 席（200 → 210）', '何佩真', 'OP-1028-001'),
  s('J012', 'yearly', 'renew', 'waiting', '2027-03-01 00:00', 'C0024', 'S025', '每年自動續約', '王雅琪'),
  s('J013', 'yearly', 'renew', 'waiting', '2027-05-19 00:00', 'C0003', 'S004', '每年自動續約', '王雅琪'),
  s('J014', 'once', 'addSeats', 'cancelled', '2026-10-25 00:00', 'C0014', 'S015', '加購 4 席（客戶撤回）', '何佩真'),
  s('J015', 'monthly', 'sync', 'done', '2026-11-01 06:00', 'C0011', 'S012', '每月同步訂閱與授權指派', '張家銘'),
  s('J016', 'once', 'addSeats', 'waiting', '2026-11-08 00:00', 'C0012', 'S013', '加購 2 席（6 → 8）', '何佩真', 'OP-1105-001'),
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
  operationId?: string,
): Schedule {
  return { id, kind, action, status, enabledAt, customerId, subscriptionId, detail, createdBy, operationId };
}
