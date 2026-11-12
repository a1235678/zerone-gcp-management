import type { HistoryEvent, NewCustomerDraft, WorkOrder, WorkOrderPayload, WorkOrderStatus, WorkOrderType } from '../types';

// 執行單：業務接到客戶需求後開立，業務主管、技術主管依序簽核，再由後勤處理。
export const SALES_MANAGER = '蔡明峰';
export const TECH_MANAGER = '鄭志豪';
const OPS = '何佩真';

type Step = [at: string, status: WorkOrderStatus];

/** 依時間點產生標準歷程：草稿 → 送出簽核 → 業務主管核准 → 技術主管核准 → 開始處理 → 完成 */
function history(by: string, createdAt: string, steps: Step[], returnNote?: string): HistoryEvent<WorkOrderStatus>[] {
  const ev: HistoryEvent<WorkOrderStatus>[] = [{ at: createdAt, by, action: '建立草稿', status: 'draft' }];
  for (const [at, status] of steps) {
    const map: Record<WorkOrderStatus, { by: string; action: string }> = {
      draft: { by, action: '建立草稿' },
      salesReview: { by, action: '送出簽核' },
      techReview: { by: SALES_MANAGER, action: '業務主管核准' },
      approved: { by: TECH_MANAGER, action: '技術主管核准' },
      processing: { by: OPS, action: '開始處理' },
      completed: { by: '系統', action: '所有步驟完成' },
      returned: { by: SALES_MANAGER, action: '業務主管退回' },
    };
    ev.push({ at, status, ...map[status], note: status === 'returned' ? returnNote : undefined });
  }
  return ev;
}

function wo(
  id: string,
  type: WorkOrderType,
  customer: { customerId?: string; newCustomer?: NewCustomerDraft },
  dealerId: string,
  subscriptionId: string | undefined,
  payload: WorkOrderPayload,
  createdBy: string,
  createdAt: string,
  steps: Step[],
  extra: { operationId?: string; returnReason?: string } = {},
): WorkOrder {
  const h = history(createdBy, createdAt, steps, extra.returnReason);
  return {
    id,
    type,
    customerMode: customer.newCustomer ? 'new' : 'existing',
    customerId: customer.customerId,
    newCustomer: customer.newCustomer,
    dealerId,
    subscriptionId,
    payload,
    status: h[h.length - 1].status,
    returnReason: extra.returnReason,
    operationId: extra.operationId,
    createdBy,
    createdAt,
    updatedAt: h[h.length - 1].at,
    history: h,
  };
}

const newClinic: NewCustomerDraft = {
  name: '青松診所',
  taxId: '90010031',
  primaryDomain: '',
  contactName: '駱婉君',
  contactEmail: 'admin@qingsong-clinic.example',
  contactPhone: '02-2758-1031',
  note: '診所新開幕，需在 11 月中前開通',
};

const newFarm: NewCustomerDraft = {
  name: '霧峰農創',
  taxId: '90010032',
  primaryDomain: '',
  contactName: '林郁婷',
  contactEmail: 'admin@wufeng-agri.example',
  contactPhone: '04-2330-1032',
  note: '',
};

export const workOrders: WorkOrder[] = [
  wo('WO-1105-002', 'renewal', { customerId: 'C0019' }, 'D001', 'S020', { plan: 'Business Plus', seats: 16, renewMonths: 12, memo: '客戶要升級到 Business Plus' }, '李冠霖', '2026-11-05 09:40', [['2026-11-05 09:44', 'salesReview']]),
  wo('WO-1105-001', 'addSeats', { customerId: 'C0016' }, 'D002', 'S017', { addSeats: 6, memo: '新進人員 6 名' }, '黃柏翰', '2026-11-05 09:12', []),
  wo('WO-1104-001', 'new', { newCustomer: newClinic }, 'D000', undefined, { domain: 'qingsong-clinic.example', domainMode: 'purchase', plan: 'Business Starter', seats: 10 }, '黃柏翰', '2026-11-04 15:10', [
    ['2026-11-04 15:12', 'salesReview'],
    ['2026-11-04 16:30', 'techReview'],
    ['2026-11-05 09:05', 'approved'],
  ]),
  wo('WO-1104-002', 'addSeats', { customerId: 'C0012' }, 'D000', 'S013', { addSeats: 2 }, '黃柏翰', '2026-11-04 09:58', [
    ['2026-11-04 10:02', 'salesReview'],
    ['2026-11-04 14:20', 'techReview'],
    ['2026-11-05 09:00', 'approved'],
    ['2026-11-05 10:15', 'processing'],
  ], { operationId: 'OP-1105-001' }),
  wo('WO-1103-003', 'new', { newCustomer: newFarm }, 'D003', undefined, { domain: 'wufeng-agri.example', domainMode: 'bind', plan: 'Business Standard', seats: 12 }, '李冠霖', '2026-11-03 16:20', [
    ['2026-11-03 16:31', 'salesReview'],
    ['2026-11-04 11:00', 'techReview'],
  ]),
  wo('WO-1102-001', 'renewal', { customerId: 'C0005' }, 'D003', 'S006', { plan: 'Business Standard', seats: 60, renewMonths: 12 }, '李冠霖', '2026-11-02 17:45', [
    ['2026-11-02 17:50', 'salesReview'],
    ['2026-11-03 10:20', 'returned'],
  ], { returnReason: '請先和客戶確認是否改為 24 個月' }),
  wo('WO-1027-001', 'addSeats', { customerId: 'C0011' }, 'D002', 'S012', { addSeats: 10 }, '黃柏翰', '2026-10-27 14:10', [
    ['2026-10-27 14:12', 'salesReview'],
    ['2026-10-27 17:00', 'techReview'],
    ['2026-10-28 10:00', 'approved'],
    ['2026-10-28 14:30', 'processing'],
    ['2026-10-28 14:41', 'completed'],
  ], { operationId: 'OP-1028-001' }),
  wo(
    'WO-1027-002',
    'transfer',
    {
      customerId: 'C0023',
      newCustomer: {
        name: '白鷺鷥文創',
        taxId: '90010023',
        primaryDomain: 'egret-creative.example',
        contactName: '江承翰',
        contactEmail: 'admin@egret-creative.example',
        contactPhone: '06-2200-1023',
        note: '',
      },
    },
    'D002',
    undefined,
    { transferSource: 'otherDealer', memo: '客戶已在 Google 申請移轉' },
    '黃柏翰',
    '2026-10-27 09:20',
    [
      ['2026-10-27 09:25', 'salesReview'],
      ['2026-10-27 15:00', 'techReview'],
      ['2026-10-28 09:00', 'approved'],
      ['2026-10-29 10:05', 'processing'],
      ['2026-11-03 10:30', 'completed'],
    ],
    { operationId: 'OP-1103-002' },
  ),
  wo(
    'WO-1017-001',
    'transfer',
    {
      customerId: 'C0027',
      newCustomer: {
        name: '曉風出版社',
        taxId: '90010027',
        primaryDomain: 'xiaofeng-press.example',
        contactName: '馮靜宜',
        contactEmail: 'admin@xiaofeng-press.example',
        contactPhone: '02-2368-1027',
        note: '',
      },
    },
    'D003',
    undefined,
    { transferSource: 'otherDealer', memo: '客戶已在 Google 申請移轉' },
    '黃柏翰',
    '2026-10-17 13:30',
    [
      ['2026-10-17 13:40', 'salesReview'],
      ['2026-10-17 17:00', 'techReview'],
      ['2026-10-19 09:00', 'approved'],
      ['2026-11-04 14:00', 'processing'],
    ],
    { operationId: 'OP-1104-003' },
  ),
];
