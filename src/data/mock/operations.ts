import type { GwsOperation, HistoryEvent, OperationPayload, OperationStatus, OperationType } from '../types';

// GWS 操作：後勤直接送 Google 的變更。訂閱的席次、到期日已反映「完成」的操作結果。
// 例如 OP-1104-001 完成後 S009 為 75 席；OP-1103-001 失敗，所以 S007 仍是 130 席。

function op(
  id: string,
  type: OperationType,
  customerId: string,
  subscriptionId: string | undefined,
  payload: OperationPayload,
  status: OperationStatus,
  createdAt: string,
  doneAt: string | undefined,
  createdBy: string,
  extra: { workOrderId?: string; failureReason?: string; manualNote?: string } = {},
): GwsOperation {
  const history: HistoryEvent<OperationStatus>[] = [{ at: createdAt, by: createdBy, action: '送出 Google', status: 'submitted' }];
  if (status === 'completed') history.push({ at: doneAt!, by: '系統', action: 'Google 回應完成', status: 'completed' });
  if (status === 'failed') history.push({ at: doneAt!, by: '系統', action: 'Google 回應失敗', status: 'failed', note: extra.failureReason });
  if (status === 'manual') {
    history.push({ at: doneAt!, by: '系統', action: 'Google 回應失敗', status: 'failed', note: '逾時沒有回應' });
    history.push({ at: doneAt!, by: createdBy, action: '改為在 Google 手動處理', status: 'manual', note: extra.manualNote });
  }
  return {
    id,
    type,
    customerId,
    subscriptionId,
    payload,
    status,
    createdBy,
    createdAt,
    updatedAt: history[history.length - 1].at,
    ...extra,
    history,
  };
}

export const operations: GwsOperation[] = [
  op('OP-1105-001', 'seats', 'C0012', 'S013', { fromSeats: 6, toSeats: 8 }, 'submitted', '2026-11-05 10:15', undefined, '何佩真', { workOrderId: 'WO-1104-002' }),
  op('OP-1104-002', 'renewal', 'C0002', 'S002', { renewMonths: 12 }, 'submitted', '2026-11-04 14:02', undefined, '何佩真'),
  op('OP-1104-001', 'seats', 'C0008', 'S009', { fromSeats: 70, toSeats: 75 }, 'completed', '2026-11-04 10:40', '2026-11-04 10:41', '何佩真'),
  op('OP-1103-001', 'seats', 'C0006', 'S007', { fromSeats: 130, toSeats: 120 }, 'failed', '2026-11-03 16:00', '2026-11-03 16:01', '何佩真', {
    failureReason: '席次不可低於目前已指派的授權數（124）',
  }),
  op('OP-1103-002', 'transfer', 'C0023', undefined, { transferToken: 'K7Q2-9XMB-4TRW', tokenExpiresAt: '2026-11-12' }, 'completed', '2026-11-03 10:05', '2026-11-03 10:30', '何佩真', {
    workOrderId: 'WO-1027-002',
  }),
  op('OP-1030-001', 'cancel', 'C0015', 'S016', { memo: '經銷商暫停合作' }, 'completed', '2026-10-30 10:30', '2026-10-30 10:31', '何佩真'),
  op('OP-1028-001', 'seats', 'C0011', 'S012', { fromSeats: 200, toSeats: 210 }, 'completed', '2026-10-28 14:40', '2026-10-28 14:41', '何佩真', {
    workOrderId: 'WO-1027-001',
  }),
  op('OP-1022-001', 'seats', 'C0024', 'S025', { fromSeats: 140, toSeats: 150 }, 'completed', '2026-10-22 11:30', '2026-10-22 11:31', '何佩真'),
  op('OP-1020-001', 'transfer', 'C0027', undefined, { transferToken: 'P3LM-7QZD-81CA', tokenExpiresAt: '2026-10-18' }, 'failed', '2026-10-20 14:00', '2026-10-20 14:01', '何佩真', {
    workOrderId: 'WO-1017-001',
    failureReason: '轉移碼已過期，請客戶重新產生',
  }),
  op('OP-1015-001', 'renewal', 'C0010', 'S011', { renewMonths: 12 }, 'manual', '2026-10-15 11:00', '2026-10-15 11:05', '何佩真', {
    manualNote: '已在 Google 經銷商後台手動續約 12 個月，等下次同步確認',
  }),
  op('OP-1002-001', 'cancel', 'C0009', 'S010', { memo: '客戶停止合作' }, 'completed', '2026-10-02 10:00', '2026-10-02 10:01', '何佩真'),
];
