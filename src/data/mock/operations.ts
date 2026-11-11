import type { ExecutionMode, GwsOperation, HistoryEvent, OperationPayload, OperationStatus, OperationType } from '../types';

// GWS 訂單操作（2026/11/10 會議的類型與執行方式）。訂閱的席次、到期日已反映「完成」的操作結果。
// 例如 OP-1104-001 完成後 S009 為 75 席；OP-1103-001 失敗，所以 S007 仍是 130 席。
// OP-1104-002 已排了 S002 的續約（11/21），這時再加購 S002 會跳出排程衝突提醒。

const OPS = '何佩真';

function op(
  id: string,
  type: OperationType,
  execution: ExecutionMode,
  customerId: string,
  subscriptionId: string | undefined,
  payload: OperationPayload,
  status: OperationStatus,
  createdAt: string,
  doneAt?: string,
  extra: { workOrderId?: string; scheduleId?: string; failureReason?: string; manualNote?: string } = {},
): GwsOperation {
  const history: HistoryEvent<OperationStatus>[] = [];
  if (execution === 'schedule') {
    history.push({ at: createdAt, by: OPS, action: `建立排程${extra.scheduleId ? ` ${extra.scheduleId}` : ''}，${payload.scheduledAt?.replace(/-/g, '/')} 執行`, status: 'scheduled' });
    if (status !== 'scheduled') history.push({ at: doneAt!, by: '系統', action: '排程啟動，送出 Google', status: 'submitted' });
    if (status === 'completed') history.push({ at: doneAt!, by: '系統', action: 'Google 回應完成', status: 'completed' });
    if (status === 'failed') history.push({ at: doneAt!, by: '系統', action: 'Google 回應失敗', status: 'failed', note: extra.failureReason });
  } else {
    history.push({ at: createdAt, by: OPS, action: '建立，待後勤人工執行', status: 'pendingManual' });
    if (status === 'manual' || status === 'completed') history.push({ at: doneAt!, by: OPS, action: '已在 Google 完成人工處理', status: 'manual', note: extra.manualNote });
    if (status === 'completed') history.push({ at: doneAt!, by: '系統', action: '同步確認完成', status: 'completed' });
  }
  return {
    id,
    type,
    execution,
    customerId,
    subscriptionId,
    payload,
    status,
    createdBy: OPS,
    createdAt,
    updatedAt: history[history.length - 1].at,
    ...extra,
    history,
  };
}

export const operations: GwsOperation[] = [
  op('OP-1105-001', 'addSeats', 'schedule', 'C0012', 'S013', { fromPlan: 'Business Starter', fromSeats: 6, addSeats: 2, scheduledAt: '2026-11-08' }, 'scheduled', '2026-11-05 10:15', undefined, {
    workOrderId: 'WO-1104-002',
    scheduleId: 'J016',
  }),
  op(
    'OP-1104-002',
    'renewal',
    'schedule',
    'C0002',
    'S002',
    { fromPlan: 'Business Standard', fromSeats: 45, plan: 'Business Standard', seats: 50, renewMonths: 12, newStartsAt: '2026-11-21', newExpiresAt: '2027-11-20', scheduledAt: '2026-11-21' },
    'scheduled',
    '2026-11-04 14:02',
    undefined,
    { scheduleId: 'J003' },
  ),
  op('OP-1104-001', 'addSeats', 'schedule', 'C0008', 'S009', { fromPlan: 'Business Plus', fromSeats: 70, addSeats: 5, scheduledAt: '2026-11-04' }, 'completed', '2026-11-04 10:30', '2026-11-04 10:31', {
    scheduleId: 'J008',
  }),
  op('OP-1103-001', 'addSeats', 'schedule', 'C0006', 'S007', { fromPlan: 'Business Starter', fromSeats: 130, addSeats: 10, scheduledAt: '2026-11-03' }, 'failed', '2026-11-03 15:40', '2026-11-03 16:00', {
    scheduleId: 'J007',
    failureReason: '經銷商帳戶付款方式驗證失敗',
  }),
  op('OP-1103-002', 'transfer', 'manual', 'C0023', undefined, { transferSource: 'otherDealer', transferToken: 'K7Q2-9XMB-4TRW', tokenExpiresAt: '2026-11-12' }, 'completed', '2026-10-29 10:05', '2026-11-03 10:30', {
    workOrderId: 'WO-1027-002',
    manualNote: '已在 Google 經銷商後台接受移轉',
  }),
  op('OP-1104-003', 'transfer', 'manual', 'C0027', undefined, { transferSource: 'otherDealer', transferToken: 'P3LM-7QZD-81CA', tokenExpiresAt: '2026-11-15' }, 'pendingManual', '2026-11-04 14:00', undefined, {
    workOrderId: 'WO-1017-001',
  }),
  op('OP-1028-001', 'addSeats', 'schedule', 'C0011', 'S012', { fromPlan: 'Enterprise Standard', fromSeats: 200, addSeats: 10, scheduledAt: '2026-10-28' }, 'completed', '2026-10-28 14:30', '2026-10-28 14:41', {
    workOrderId: 'WO-1027-001',
    scheduleId: 'J009',
  }),
  op('OP-1022-001', 'addSeats', 'schedule', 'C0024', 'S025', { fromPlan: 'Enterprise Standard', fromSeats: 140, addSeats: 10, scheduledAt: '2026-10-22' }, 'completed', '2026-10-22 11:00', '2026-10-22 11:31'),
  op(
    'OP-1015-001',
    'renewal',
    'manual',
    'C0010',
    'S011',
    { fromPlan: 'Business Standard', fromSeats: 15, plan: 'Business Standard', seats: 12, renewMonths: 12, newStartsAt: '2026-12-02', newExpiresAt: '2027-12-01' },
    'manual',
    '2026-10-15 11:00',
    '2026-10-15 15:20',
    { manualNote: '已在 Google 經銷商後台設定續約並減為 12 席，等下次同步確認' },
  ),
];
