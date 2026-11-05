/**
 * 資料層：頁面只透過這裡的函式取得或修改資料。
 * 目前回傳記憶體中的假資料；拿到 Terry 的 API 後，只需要把函式內容換成 fetch 呼叫，頁面不用動。
 * 所有寫入只改記憶體，重新整理頁面就會回到初始資料。
 * 真正的權限與資料範圍檢查必須在後端做，這裡不模擬。
 */
import { brands as seedBrands, products as seedProducts } from './mock/brands';
import { customers as seedCustomers } from './mock/customers';
import { dealers as seedDealers } from './mock/dealers';
import { GCP_DAYS, GCP_PERIOD_END, gcpAccounts, gcpDates } from './mock/gcp';
import { auditLogs as seedLogs, roleOfActor } from './mock/logs';
import { roles as seedRoles } from './mock/roles';
import { schedules as seedSchedules } from './mock/schedules';
import { gwsPlans, subscriptions as seedSubscriptions } from './mock/subscriptions';
import { users as seedUsers } from './mock/users';
import { workOrders as seedWorkOrders } from './mock/workOrders';
import { orgTypeLabel, workOrderTypeLabel } from './labels';
import type {
  AuditLog,
  AuditLogQuery,
  Brand,
  BrandListItem,
  Customer,
  CustomerListItem,
  CustomerQuery,
  Dealer,
  DealerListItem,
  DomainCheck,
  GcpUsage,
  LogCategory,
  LogResult,
  NewCustomerInput,
  NewUserInput,
  NewWorkOrderInput,
  OrgType,
  Product,
  ProductListItem,
  Role,
  RoleListItem,
  ScheduleListItem,
  ScheduleQuery,
  Subscription,
  SubscriptionListItem,
  SubscriptionQuery,
  UserListItem,
  UserQuery,
  UserStatus,
  WorkOrder,
  WorkOrderAction,
  WorkOrderListItem,
  WorkOrderQuery,
} from './types';

// ═════════ 共用 ═════════

/** Prototype 的「今天」，到期判斷、Dashboard 都以這天為準 */
export const TODAY = '2026-11-05';
/** 「即將到期」的天數門檻 */
export const EXPIRING_DAYS = 30;

/** 目前登入者（之後由登入狀態取得） */
export const currentUser = { id: 'U001', name: '林怡君', role: '後台管理員' };

const db = {
  dealers: structuredClone(seedDealers),
  customers: structuredClone(seedCustomers),
  subscriptions: structuredClone(seedSubscriptions),
  workOrders: structuredClone(seedWorkOrders),
  schedules: structuredClone(seedSchedules),
  users: structuredClone(seedUsers),
  roles: structuredClone(seedRoles),
  logs: structuredClone(seedLogs),
  brands: structuredClone(seedBrands),
  products: structuredClone(seedProducts),
};

/** 模擬網路延遲，回傳複本避免頁面直接改到資料 */
const delay = <T>(value: T, ms = 150) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
const fail = (message: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), 150));

/** 模擬時鐘：從 2026-11-05 10:30 起算，加上開啟頁面後經過的真實時間 */
const clockStart = Date.now();
export function now(): string {
  const d = new Date(Date.UTC(2026, 10, 5, 10, 30) + (Date.now() - clockStart));
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonths = (date: string, months: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
export const daysUntil = (date: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000);

const dealerName = (id: string) => db.dealers.find((d) => d.id === id)?.name ?? '（未知經銷商）';
const customerOf = (id: string) => db.customers.find((c) => c.id === id);
const includesKw = (kw: string, ...fields: (string | undefined)[]) =>
  !kw || fields.some((f) => f?.toLowerCase().includes(kw));
const normKw = (kw?: string) => kw?.trim().toLowerCase() ?? '';

function log(category: LogCategory, target: string, action: string, result: LogResult = 'success', customerId?: string, actor = currentUser.name) {
  const id = `L${String(db.logs.length + 1).padStart(4, '0')}`;
  db.logs.unshift({ id, at: now(), actor, actorRole: actor === currentUser.name ? currentUser.role : roleOfActor(actor), category, target, customerId, action, result });
}

// ═════════ 經銷商 ═════════

export function getDealers(): Promise<Dealer[]> {
  return delay(db.dealers);
}

function dealerListItem(d: Dealer): DealerListItem {
  const customerIds = new Set(db.customers.filter((c) => c.dealerId === d.id).map((c) => c.id));
  const totalSeats = db.subscriptions
    .filter((s) => customerIds.has(s.customerId) && s.product === 'GWS' && s.status !== 'cancelled')
    .reduce((sum, s) => sum + (s.seats ?? 0), 0);
  return {
    ...d,
    customerCount: customerIds.size,
    totalSeats,
    accountCount: db.users.filter((u) => u.orgType === 'dealer' && u.orgId === d.id).length,
  };
}

export function getDealerList(query: { keyword?: string; status?: string } = {}): Promise<DealerListItem[]> {
  const kw = normKw(query.keyword);
  return delay(
    db.dealers
      .filter((d) => !query.status || d.status === query.status)
      .filter((d) => includesKw(kw, d.name))
      .map(dealerListItem),
  );
}

export function createDealer(input: { name: string; adminName: string; adminEmail: string }): Promise<DealerListItem> {
  const name = input.name.trim();
  if (db.dealers.some((d) => d.name === name)) return fail('已有同名的經銷商');
  const email = input.adminEmail.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) return fail('這個 Email 已經有帳號');
  const id = `D${String(db.dealers.length).padStart(3, '0')}`;
  const dealer: Dealer = { id, name, isDirect: false, status: 'active', createdAt: TODAY };
  db.dealers.push(dealer);
  db.users.push({
    id: nextUserId(),
    name: input.adminName.trim(),
    email,
    orgType: 'dealer',
    orgId: id,
    roleId: 'R08',
    status: 'invited',
    isFirstAdmin: true,
    lastLoginAt: null,
    createdAt: TODAY,
  });
  log('customer', name, '新增經銷商');
  log('permission', email, `建立第一個組織管理員帳號（${name}），已寄出邀請`);
  return delay(dealerListItem(dealer));
}

// ═════════ 客戶 ═════════

const withDealer = (c: Customer): CustomerListItem => ({ ...c, dealerName: dealerName(c.dealerId) });

export function getCustomers(query: CustomerQuery = {}): Promise<CustomerListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.customers
    .filter((c) => !query.dealerId || c.dealerId === query.dealerId)
    .filter((c) => !query.status || c.status === query.status)
    .filter((c) => includesKw(kw, c.name, c.primaryDomain, c.taxId, c.contactName))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map(withDealer);
  return delay(rows);
}

export function getCustomer(id: string): Promise<CustomerListItem | undefined> {
  const c = customerOf(id);
  return delay(c ? withDealer(c) : undefined);
}

/** 主網域格式（handoff「網域檢查規則」） */
export const DOMAIN_PATTERN = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/** 網域檢查：格式＋系統內不重複。Google 網域驗證要等客戶建立後才檢查。 */
export function checkDomain(domain: string): DomainCheck {
  const d = domain.trim();
  if (!d) return { ok: false, reason: 'empty', message: '請輸入主網域' };
  if (!DOMAIN_PATTERN.test(d)) {
    const hint = /[A-Z]/.test(d)
      ? '只能使用小寫英文字母'
      : /^https?:|\//.test(d)
        ? '請只填網域，不要加 http:// 或路徑'
        : '格式不正確，例如 company.example';
    return { ok: false, reason: 'format', message: hint };
  }
  const existing = db.customers.find((c) => c.primaryDomain === d);
  if (existing) return { ok: false, reason: 'duplicate', message: `這個網域已被「${existing.name}」使用`, existingCustomer: existing.id };
  return { ok: true };
}

export function createCustomer(input: NewCustomerInput): Promise<CustomerListItem> {
  const check = checkDomain(input.primaryDomain);
  if (!check.ok) return fail(check.message);
  const email = input.adminEmail.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) return fail('組織管理員的 Email 已經有帳號');
  const id = `C${String(db.customers.length + 1).padStart(4, '0')}`;
  const customer: Customer = {
    id,
    name: input.name.trim(),
    taxId: input.taxId.trim(),
    primaryDomain: input.primaryDomain.trim(),
    dealerId: input.dealerId,
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    createdBy: currentUser.name,
    createdAt: TODAY,
    note: input.note.trim(),
    status: 'active',
    domainVerification: 'pending',
  };
  db.customers.push(customer);
  db.users.push({
    id: nextUserId(),
    name: input.adminName.trim(),
    email,
    orgType: 'customer',
    orgId: id,
    roleId: 'R09',
    status: 'invited',
    isFirstAdmin: true,
    lastLoginAt: null,
    createdAt: TODAY,
  });
  log('customer', customer.name, `新增客戶（${customer.primaryDomain}）`, 'success', id);
  log('permission', email, `建立第一個組織管理員帳號（${customer.name}），已寄出邀請`, 'success', id);
  return delay(withDealer(customer));
}

/** 轉移碼有效天數（依 Google Cloud Channel 文件，待 Ray 確認） */
export const TRANSFER_TOKEN_VALID_DAYS = 14;

/** 檢查轉移碼欄位，回傳各欄位的錯誤訊息 */
export function checkTransferToken(token: string, expiresAt: string): { token?: string; tokenExpiresAt?: string } {
  const e: { token?: string; tokenExpiresAt?: string } = {};
  const max = addDays(TODAY, TRANSFER_TOKEN_VALID_DAYS);
  if (!token.trim()) e.token = '請輸入客戶提供的轉移碼';
  if (!expiresAt) e.tokenExpiresAt = '請輸入轉移碼到期日';
  else if (expiresAt < TODAY) e.tokenExpiresAt = '轉移碼已過期，請客戶重新產生';
  else if (expiresAt > max) e.tokenExpiresAt = `轉移碼最長 ${TRANSFER_TOKEN_VALID_DAYS} 天有效，到期日不會晚於 ${max}`;
  return e;
}

/** 轉入客戶：從其他經銷商轉進來的新客戶，同時建立客戶主檔與轉移執行單 */
export async function createTransferInCustomer(
  input: NewCustomerInput & { transferToken: string; tokenExpiresAt: string; memo: string; submit: boolean },
): Promise<{ customer: CustomerListItem; workOrder: WorkOrderListItem }> {
  const tokenErrors = checkTransferToken(input.transferToken, input.tokenExpiresAt);
  const firstError = tokenErrors.token ?? tokenErrors.tokenExpiresAt;
  if (firstError) return fail(firstError);
  const customer = await createCustomer({ ...input, note: input.note || '由其他經銷商轉入' });
  const workOrder = await createWorkOrder({
    type: 'transfer',
    customerId: customer.id,
    payload: { transferToken: input.transferToken.trim(), tokenExpiresAt: input.tokenExpiresAt, memo: input.memo.trim() || undefined },
    submit: input.submit,
  });
  return { customer, workOrder };
}

/** 模擬向 Google 檢查網域驗證：第一次查會是「尚未驗證」，第二次起通過 */
const verifyAttempts: Record<string, number> = {};
export function recheckDomainVerification(customerId: string): Promise<CustomerListItem> {
  const c = customerOf(customerId);
  if (!c) return fail('找不到客戶');
  verifyAttempts[customerId] = (verifyAttempts[customerId] ?? 0) + 1;
  if (verifyAttempts[customerId] >= 2 || c.domainVerification === 'failed') {
    c.domainVerification = 'verified';
    log('sync', c.primaryDomain, 'Google 網域驗證通過', 'success', c.id, '系統');
  } else {
    c.domainVerification = 'pending';
    log('sync', c.primaryDomain, 'Google 網域驗證未通過：尚未找到驗證 TXT 記錄', 'warning', c.id, '系統');
  }
  return delay(withDealer(c));
}

export function setCustomerStatus(customerId: string, status: Customer['status']): Promise<CustomerListItem> {
  const c = customerOf(customerId);
  if (!c) return fail('找不到客戶');
  c.status = status;
  log('customer', c.name, status === 'active' ? '啟用客戶' : '停用客戶', 'success', c.id);
  return delay(withDealer(c));
}

// ═════════ 訂閱 ═════════

/** 狀態：已取消保留；其餘依到期日計算 */
function effectiveStatus(s: Subscription): Subscription['status'] {
  if (s.status === 'cancelled') return 'cancelled';
  return daysUntil(s.expiresAt) <= EXPIRING_DAYS ? 'expiring' : 'active';
}

/** 處理中的執行單：同一筆訂閱（或同一客戶的轉移）同時只能有一張。失敗的單可以重送，也可以另開新單。 */
const isOpen = (wo: WorkOrder) => wo.status === 'draft' || wo.status === 'pending' || wo.status === 'submitted';

function subscriptionListItem(s: Subscription): SubscriptionListItem {
  const c = customerOf(s.customerId)!;
  return {
    ...s,
    status: effectiveStatus(s),
    customerName: c.name,
    primaryDomain: c.primaryDomain,
    dealerId: c.dealerId,
    dealerName: dealerName(c.dealerId),
    openWorkOrderId: db.workOrders.find((w) => w.subscriptionId === s.id && isOpen(w))?.id,
  };
}

export function getSubscriptions(query: SubscriptionQuery = {}): Promise<SubscriptionListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.subscriptions
    .filter((s) => !query.product || s.product === query.product)
    .map(subscriptionListItem)
    .filter((s) => !query.dealerId || s.dealerId === query.dealerId)
    .filter((s) => !query.status || s.status === query.status)
    .filter((s) => !query.plan || s.plan === query.plan)
    .filter((s) => includesKw(kw, s.customerName, s.primaryDomain, s.plan))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return delay(rows);
}

export function getPlans(): Promise<string[]> {
  return delay(gwsPlans);
}

// ═════════ 執行單 ═════════

function describeWorkOrder(wo: WorkOrder): string {
  const sub = db.subscriptions.find((s) => s.id === wo.subscriptionId);
  const plan = sub?.plan ?? wo.payload.plan ?? '';
  switch (wo.type) {
    case 'new':
      return `${wo.payload.plan} ${wo.payload.seats} 席`;
    case 'renewal':
      return `${plan} 續約 ${wo.payload.renewMonths} 個月`;
    case 'seats':
      return `${plan}：${wo.payload.fromSeats} → ${wo.payload.toSeats} 席`;
    case 'cancel':
      return `取消 ${plan}`;
    case 'transfer':
      return `轉入，轉移碼 ${wo.payload.transferToken}`;
  }
}

function workOrderListItem(wo: WorkOrder): WorkOrderListItem {
  const c = customerOf(wo.customerId)!;
  return {
    ...wo,
    customerName: c.name,
    primaryDomain: c.primaryDomain,
    dealerName: dealerName(wo.dealerId),
    summary: describeWorkOrder(wo),
  };
}

export function getWorkOrders(query: WorkOrderQuery = {}): Promise<WorkOrderListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.workOrders
    .filter((w) => !query.type || w.type === query.type)
    .filter((w) => !query.status || w.status === query.status)
    .filter((w) => !query.dealerId || w.dealerId === query.dealerId)
    .filter((w) => !query.customerId || w.customerId === query.customerId)
    .map(workOrderListItem)
    .filter((w) => includesKw(kw, w.id, w.customerName, w.primaryDomain, w.summary))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(rows);
}

export function getWorkOrder(id: string): Promise<WorkOrderListItem | undefined> {
  const wo = db.workOrders.find((w) => w.id === id);
  return delay(wo ? workOrderListItem(wo) : undefined);
}

/** 單號 WO-MMDD-NNN，NNN 為當日流水號 */
function nextWorkOrderId(at: string) {
  const mmdd = at.slice(5, 7) + at.slice(8, 10);
  const prefix = `WO-${mmdd}-`;
  const max = db.workOrders.filter((w) => w.id.startsWith(prefix)).reduce((m, w) => Math.max(m, Number(w.id.slice(-3))), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function createWorkOrder(input: NewWorkOrderInput): Promise<WorkOrderListItem> {
  const c = customerOf(input.customerId);
  if (!c) return fail('找不到客戶');
  if (input.subscriptionId) {
    const open = db.workOrders.find((w) => w.subscriptionId === input.subscriptionId && isOpen(w));
    if (open) return fail(`這筆訂閱已有處理中的執行單 ${open.id}，請先處理`);
  }
  if (input.type === 'transfer') {
    const open = db.workOrders.find((w) => w.customerId === c.id && w.type === 'transfer' && isOpen(w));
    if (open) return fail(`這個客戶已有處理中的轉移執行單 ${open.id}`);
  }
  const at = now();
  const wo: WorkOrder = {
    id: nextWorkOrderId(at),
    type: input.type,
    customerId: c.id,
    dealerId: c.dealerId,
    subscriptionId: input.subscriptionId,
    payload: input.payload,
    status: input.submit ? 'pending' : 'draft',
    createdBy: currentUser.name,
    createdAt: at,
    updatedAt: at,
    history: [{ at, by: currentUser.name, action: '建立草稿', status: 'draft' }],
  };
  if (input.submit) wo.history.push({ at, by: currentUser.name, action: '送出確認', status: 'pending' });
  db.workOrders.push(wo);
  log('workOrder', wo.id, `開立${workOrderTypeLabel[wo.type]}執行單：${describeWorkOrder(wo)}`, 'success', c.id);
  if (input.submit) log('workOrder', wo.id, '送出確認', 'success', c.id);
  return delay(workOrderListItem(wo));
}

/** 執行單狀態流程：草稿 → 待確認 → 已送出 Google → 完成；失敗可重送 */
const transitions: Record<WorkOrderAction, { from: WorkOrder['status'][]; to: WorkOrder['status'] | null; label: string }> = {
  requestConfirm: { from: ['draft'], to: 'pending', label: '送出確認' },
  backToDraft: { from: ['pending'], to: 'draft', label: '退回草稿' },
  confirmAndSend: { from: ['pending'], to: 'submitted', label: '確認並送出 Google' },
  simulateSuccess: { from: ['submitted'], to: 'completed', label: 'Google 回應完成' },
  simulateFailure: { from: ['submitted'], to: 'failed', label: 'Google 回應失敗' },
  resend: { from: ['failed'], to: 'submitted', label: '重送 Google' },
  discard: { from: ['draft'], to: null, label: '刪除草稿' },
};

export function actOnWorkOrder(id: string, action: WorkOrderAction, note?: string): Promise<WorkOrderListItem | null> {
  const wo = db.workOrders.find((w) => w.id === id);
  if (!wo) return fail('找不到執行單');
  const t = transitions[action];
  if (!t.from.includes(wo.status)) return fail('執行單狀態已變更，請重新整理');
  const at = now();
  const isSystem = action === 'simulateSuccess' || action === 'simulateFailure';
  const by = isSystem ? '系統' : currentUser.name;

  if (t.to === null) {
    db.workOrders = db.workOrders.filter((w) => w.id !== id);
    log('workOrder', id, t.label, 'success', wo.customerId);
    return delay(null);
  }

  let failure: string | undefined;
  if (action === 'simulateFailure') {
    failure = note || '請求參數不正確';
    wo.failureReason = failure;
  }
  if (action === 'resend') wo.failureReason = undefined;

  wo.status = t.to;
  wo.updatedAt = at;
  wo.history.push({ at, by, action: t.label, status: t.to, note: failure ?? note });
  log('workOrder', wo.id, failure ? `${t.label}：${failure}` : t.label, action === 'simulateFailure' ? 'failure' : 'success', wo.customerId, by);

  if (t.to === 'completed') applyCompletedWorkOrder(wo, at);
  return delay(workOrderListItem(wo));
}

/** 執行單完成後，把結果寫回訂閱（模擬 Google 同步回來） */
function applyCompletedWorkOrder(wo: WorkOrder, at: string) {
  const sub = db.subscriptions.find((s) => s.id === wo.subscriptionId);
  const c = customerOf(wo.customerId)!;
  switch (wo.type) {
    case 'seats':
      if (sub) sub.seats = wo.payload.toSeats ?? sub.seats;
      break;
    case 'renewal':
      if (sub) sub.expiresAt = addMonths(sub.expiresAt, wo.payload.renewMonths ?? 12);
      break;
    case 'cancel':
      if (sub) sub.status = 'cancelled';
      break;
    case 'new': {
      const id = `S${String(db.subscriptions.length + 1).padStart(3, '0')}`;
      db.subscriptions.push({
        id,
        customerId: c.id,
        product: 'GWS',
        plan: wo.payload.plan ?? 'Business Starter',
        seats: wo.payload.seats ?? 1,
        status: 'active',
        expiresAt: addMonths(TODAY, 12),
        lastSyncedAt: at,
      });
      wo.subscriptionId = id;
      break;
    }
    case 'transfer':
      log('customer', c.name, '客戶轉入完成，訂閱將於下次同步時出現在 GWS 訂閱清單', 'success', c.id, '系統');
      break;
  }
  if (sub) sub.lastSyncedAt = at;
}

// ═════════ GCP 用量 ═════════

export function getGcpUsage(): Promise<GcpUsage> {
  const dates = gcpDates();
  const rows = gcpAccounts
    .map((a) => {
      const c = customerOf(a.customerId)!;
      const costCents = a.dailyCents.reduce((s, v) => s + v, 0);
      return {
        customerId: c.id,
        customerName: c.name,
        dealerName: dealerName(c.dealerId),
        projects: a.projects,
        costCents,
        egressGb: a.egressGb,
        changePct: Math.round(((costCents - a.prevPeriodCents) / a.prevPeriodCents) * 1000) / 10,
      };
    })
    .sort((a, b) => b.costCents - a.costCents);
  const daily = dates.map((date, i) => ({ date, costCents: gcpAccounts.reduce((s, a) => s + a.dailyCents[i], 0) }));
  return delay({
    periodStart: dates[0],
    periodEnd: GCP_PERIOD_END,
    totalCostCents: rows.reduce((s, r) => s + r.costCents, 0),
    prevTotalCostCents: gcpAccounts.reduce((s, a) => s + a.prevPeriodCents, 0),
    totalEgressGb: rows.reduce((s, r) => s + r.egressGb, 0),
    totalProjects: rows.reduce((s, r) => s + r.projects, 0),
    daily,
    rows,
  });
}
export const GCP_PERIOD_DAYS = GCP_DAYS;

// ═════════ 排程 ═════════

export function getSchedules(query: ScheduleQuery = {}): Promise<ScheduleListItem[]> {
  const rows = db.schedules
    .filter((s) => !query.kind || s.kind === query.kind)
    .filter((s) => !query.action || s.action === query.action)
    .filter((s) => !query.status || s.status === query.status)
    .filter((s) => !query.from || s.enabledAt.slice(0, 10) >= query.from)
    .filter((s) => !query.to || s.enabledAt.slice(0, 10) <= query.to)
    .map((s) => {
      const c = customerOf(s.customerId)!;
      return { ...s, customerName: c.name, primaryDomain: c.primaryDomain, dealerName: dealerName(c.dealerId) };
    })
    .sort((a, b) => b.enabledAt.localeCompare(a.enabledAt));
  return delay(rows);
}

export function cancelSchedule(id: string): Promise<void> {
  const s = db.schedules.find((x) => x.id === id);
  if (!s) return fail('找不到排程');
  if (s.status !== 'waiting') return fail('只有「等待執行」的排程可以取消');
  s.status = 'cancelled';
  log('workOrder', id, '取消排程', 'success', s.customerId);
  return delay(undefined);
}

// ═════════ 使用者 ═════════

function nextUserId() {
  return `U${String(900 + db.users.filter((u) => u.id.startsWith('U9')).length + 1)}`;
}

function orgName(orgType: OrgType, orgId: string | null) {
  if (orgType === 'internal') return '零壹';
  if (!orgId) return `所有${orgTypeLabel[orgType]}`;
  return orgType === 'dealer' ? dealerName(orgId) : customerOf(orgId)?.name ?? '（未知客戶）';
}

export function getUsers(query: UserQuery = {}): Promise<UserListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.users
    .filter((u) => !query.orgType || u.orgType === query.orgType)
    .filter((u) => !query.orgId || u.orgId === query.orgId)
    .filter((u) => !query.roleId || u.roleId === query.roleId)
    .filter((u) => !query.status || u.status === query.status)
    .map((u) => ({ ...u, orgName: orgName(u.orgType, u.orgId), roleName: db.roles.find((r) => r.id === u.roleId)?.name ?? '—' }))
    .filter((u) => includesKw(kw, u.name, u.email, u.orgName))
    .sort((a, b) => ['internal', 'dealer', 'customer'].indexOf(a.orgType) - ['internal', 'dealer', 'customer'].indexOf(b.orgType) || a.id.localeCompare(b.id));
  return delay(rows);
}

/** 可以指派給帳號的組織 */
export function getOrganizations(): Promise<{ orgType: OrgType; orgId: string; name: string }[]> {
  return delay([
    { orgType: 'internal' as const, orgId: 'ZERONE', name: '零壹' },
    ...db.dealers.filter((d) => !d.isDirect).map((d) => ({ orgType: 'dealer' as const, orgId: d.id, name: d.name })),
    ...db.customers.map((c) => ({ orgType: 'customer' as const, orgId: c.id, name: c.name })),
  ]);
}

export function createUser(input: NewUserInput): Promise<UserListItem> {
  const email = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) return fail('這個 Email 已經有帳號');
  const user = {
    id: nextUserId(),
    name: input.name.trim(),
    email,
    orgType: input.orgType,
    orgId: input.orgId,
    roleId: input.roleId,
    status: 'invited' as const,
    isFirstAdmin: false,
    lastLoginAt: null,
    createdAt: TODAY,
  };
  db.users.push(user);
  log('permission', email, `新增帳號（${orgName(input.orgType, input.orgId)}），已寄出邀請`);
  return delay({ ...user, orgName: orgName(user.orgType, user.orgId), roleName: db.roles.find((r) => r.id === user.roleId)?.name ?? '—' });
}

export function setUserStatus(id: string, status: UserStatus): Promise<void> {
  const u = db.users.find((x) => x.id === id);
  if (!u) return fail('找不到帳號');
  u.status = status;
  log('permission', u.email, status === 'disabled' ? '停用帳號' : '啟用帳號');
  return delay(undefined);
}

export function resetPassword(id: string): Promise<void> {
  const u = db.users.find((x) => x.id === id);
  if (!u) return fail('找不到帳號');
  log('permission', u.email, '寄出重設密碼信');
  return delay(undefined);
}

// ═════════ 角色 ═════════

export function getRoles(query: { orgType?: OrgType | '' } = {}): Promise<RoleListItem[]> {
  return delay(
    db.roles
      .filter((r) => !query.orgType || r.orgType === query.orgType)
      .map((r) => ({ ...r, orgName: orgName(r.orgType, r.orgId), userCount: db.users.filter((u) => u.roleId === r.id).length })),
  );
}

/** 目前登入者自己的權限（權限上限：不能授予比自己更大的權限） */
export function getMyPermissions(): Promise<Role['permissions']> {
  const me = db.users.find((u) => u.id === currentUser.id)!;
  return delay(db.roles.find((r) => r.id === me.roleId)!.permissions);
}

export function saveRole(role: Omit<Role, 'id'> & { id?: string }): Promise<Role> {
  const name = role.name.trim();
  if (!name) return fail('請輸入角色名稱');
  if (db.roles.some((r) => r.name === name && r.orgType === role.orgType && r.orgId === role.orgId && r.id !== role.id))
    return fail('同一個組織已有相同名稱的角色');
  if (role.id) {
    const existing = db.roles.find((r) => r.id === role.id);
    if (!existing) return fail('找不到角色');
    Object.assign(existing, { ...role, name });
    log('permission', name, '修改角色權限');
    return delay(existing);
  }
  const created: Role = { ...role, name, id: `R${String(db.roles.length + 1).padStart(2, '0')}` };
  db.roles.push(created);
  log('permission', name, '新增角色');
  return delay(created);
}

// ═════════ 操作紀錄 ═════════

export function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLog[]> {
  const kw = normKw(query.keyword);
  return delay(
    db.logs
      .filter((l) => !query.category || l.category === query.category)
      .filter((l) => !query.result || l.result === query.result)
      .filter((l) => !query.customerId || l.customerId === query.customerId)
      .filter((l) => !query.from || l.at.slice(0, 10) >= query.from)
      .filter((l) => !query.to || l.at.slice(0, 10) <= query.to)
      .filter((l) => includesKw(kw, l.actor, l.target, l.action))
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

// ═════════ 品牌與產品 ═════════

export function getBrands(): Promise<BrandListItem[]> {
  return delay(db.brands.map((b) => ({ ...b, productCount: db.products.filter((p) => p.brandId === b.id).length })));
}
export function createBrand(name: string): Promise<Brand> {
  const n = name.trim();
  if (!n) return fail('請輸入品牌名稱');
  if (db.brands.some((b) => b.name === n)) return fail('已有同名品牌');
  const brand: Brand = { id: `B${String(db.brands.length + 1).padStart(2, '0')}`, name: n, status: 'draft', createdAt: TODAY };
  db.brands.push(brand);
  log('customer', n, '新增品牌');
  return delay(brand);
}
export function getProducts(): Promise<ProductListItem[]> {
  return delay(db.products.map((p) => ({ ...p, brandName: db.brands.find((b) => b.id === p.brandId)?.name ?? '—' })));
}
export function createProduct(input: { brandId: string; name: string; code: string }): Promise<Product> {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name || !code) return fail('請輸入產品名稱與代碼');
  if (db.products.some((p) => p.code === code)) return fail('產品代碼已存在');
  const product: Product = { id: `P${String(db.products.length + 1).padStart(2, '0')}`, brandId: input.brandId, name, code, status: 'draft', createdAt: TODAY };
  db.products.push(product);
  log('customer', name, '新增產品');
  return delay(product);
}

// ═════════ 首頁 ═════════

export async function getDashboard() {
  const [subs, orders, gcp] = await Promise.all([getSubscriptions({ product: 'GWS' }), getWorkOrders(), getGcpUsage()]);
  const live = subs.filter((s) => s.status !== 'cancelled');
  return {
    activeCustomers: db.customers.filter((c) => c.status === 'active').length,
    totalCustomers: db.customers.length,
    totalSeats: live.reduce((sum, s) => sum + (s.seats ?? 0), 0),
    liveSubscriptions: live.length,
    expiring: live.filter((s) => s.status === 'expiring'),
    expiringWithin60: live.filter((s) => daysUntil(s.expiresAt) <= 60),
    orderCounts: {
      draft: orders.filter((o) => o.status === 'draft').length,
      pending: orders.filter((o) => o.status === 'pending').length,
      submitted: orders.filter((o) => o.status === 'submitted').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      failed: orders.filter((o) => o.status === 'failed').length,
    },
    recentOrders: orders.slice(0, 6),
    gcp,
  };
}

export { addDays };
