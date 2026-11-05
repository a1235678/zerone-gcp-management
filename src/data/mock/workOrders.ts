import type { WorkOrder, WorkOrderEvent, WorkOrderPayload, WorkOrderStatus, WorkOrderType } from '../types';

const SALES = '黃柏翰';
const OPS = '張家銘';

// 依狀態產生合理的歷程
function history(status: WorkOrderStatus, createdAt: string, by: string, steps: string[], failure?: string): WorkOrderEvent[] {
  const [t1, t2, t3, t4] = steps;
  const ev: WorkOrderEvent[] = [{ at: createdAt, by, action: '建立草稿', status: 'draft' }];
  if (status === 'draft') return ev;
  ev.push({ at: t1, by, action: '送出確認', status: 'pending' });
  if (status === 'pending') return ev;
  ev.push({ at: t2, by: OPS, action: '確認並送出 Google', status: 'submitted' });
  if (status === 'submitted') return ev;
  if (status === 'completed') {
    ev.push({ at: t3, by: '系統', action: 'Google 回應完成', status: 'completed' });
    return ev;
  }
  ev.push({ at: t3, by: '系統', action: 'Google 回應失敗', status: 'failed', note: failure });
  void t4;
  return ev;
}

function wo(
  id: string,
  type: WorkOrderType,
  customerId: string,
  dealerId: string,
  subscriptionId: string | undefined,
  payload: WorkOrderPayload,
  status: WorkOrderStatus,
  createdAt: string,
  steps: string[],
  createdBy = SALES,
  failureReason?: string,
): WorkOrder {
  const h = history(status, createdAt, createdBy, steps, failureReason);
  return {
    id,
    type,
    customerId,
    dealerId,
    subscriptionId,
    payload,
    status,
    createdBy,
    createdAt,
    updatedAt: h[h.length - 1].at,
    failureReason,
    history: h,
  };
}

export const workOrders: WorkOrder[] = [
  wo('WO-1105-003', 'seats', 'C0012', 'D000', 'S013', { fromSeats: 6, toSeats: 8 }, 'submitted', '2026-11-05 09:58', ['2026-11-05 10:02', '2026-11-05 10:15']),
  wo('WO-1105-002', 'renewal', 'C0019', 'D001', 'S020', { renewMonths: 12 }, 'pending', '2026-11-05 09:40', ['2026-11-05 09:44']),
  wo('WO-1105-001', 'seats', 'C0016', 'D002', 'S017', { fromSeats: 64, toSeats: 70, memo: '新進人員 6 名' }, 'draft', '2026-11-05 09:12', []),
  wo('WO-1104-002', 'renewal', 'C0002', 'D001', 'S002', { renewMonths: 12 }, 'submitted', '2026-11-04 11:05', ['2026-11-04 11:20', '2026-11-04 14:02']),
  wo('WO-1104-001', 'new', 'C0026', 'D003', undefined, { plan: 'Business Standard', seats: 12 }, 'pending', '2026-11-04 16:20', ['2026-11-04 16:31']),
  wo('WO-1104-003', 'seats', 'C0008', 'D003', 'S009', { fromSeats: 70, toSeats: 75 }, 'completed', '2026-11-04 10:15', ['2026-11-04 10:18', '2026-11-04 10:40', '2026-11-04 10:41']),
  wo('WO-1103-001', 'seats', 'C0006', 'D002', 'S007', { fromSeats: 130, toSeats: 120 }, 'failed', '2026-11-03 15:30', ['2026-11-03 15:35', '2026-11-03 16:00', '2026-11-03 16:01'], SALES, '席次不可低於目前已指派的授權數（124）'),
  wo('WO-1103-002', 'transfer', 'C0023', 'D002', undefined, { transferToken: 'K7Q2-9XMB-4TRW', tokenExpiresAt: '2026-11-12' }, 'completed', '2026-11-03 09:20', ['2026-11-03 09:25', '2026-11-03 10:05', '2026-11-03 10:30']),
  wo('WO-1102-001', 'renewal', 'C0005', 'D003', 'S006', { renewMonths: 12 }, 'draft', '2026-11-02 17:45', []),
  wo('WO-1030-001', 'cancel', 'C0015', 'D004', 'S016', { memo: '經銷商暫停合作' }, 'completed', '2026-10-30 10:00', ['2026-10-30 10:05', '2026-10-30 10:30', '2026-10-30 10:31']),
  wo('WO-1028-001', 'seats', 'C0011', 'D002', 'S012', { fromSeats: 200, toSeats: 210 }, 'completed', '2026-10-28 14:10', ['2026-10-28 14:12', '2026-10-28 14:40', '2026-10-28 14:41']),
  wo('WO-1022-001', 'seats', 'C0024', 'D001', 'S025', { fromSeats: 140, toSeats: 150 }, 'completed', '2026-10-22 11:00', ['2026-10-22 11:05', '2026-10-22 11:30', '2026-10-22 11:31']),
  wo('WO-1020-001', 'transfer', 'C0027', 'D003', undefined, { transferToken: 'P3LM-7QZD-81CA', tokenExpiresAt: '2026-10-18' }, 'failed', '2026-10-20 13:30', ['2026-10-20 13:40', '2026-10-20 14:00', '2026-10-20 14:01'], SALES, '轉移碼已過期，請客戶重新產生'),
  wo('WO-1015-001', 'renewal', 'C0010', 'D004', 'S011', { renewMonths: 12 }, 'failed', '2026-10-15 10:20', ['2026-10-15 10:22', '2026-10-15 11:00', '2026-10-15 11:05'], SALES, '逾時沒有回應，請重送'),
  wo('WO-1002-001', 'cancel', 'C0009', 'D001', 'S010', { memo: '客戶停止合作' }, 'completed', '2026-10-02 09:30', ['2026-10-02 09:32', '2026-10-02 10:00', '2026-10-02 10:01']),
];
