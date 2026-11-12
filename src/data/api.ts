/**
 * 資料層：頁面只透過這裡的函式取得或修改資料。
 * 目前回傳記憶體中的假資料；拿到 Terry 的 API 後，只需要把函式內容換成 fetch 呼叫，頁面不用動。
 * 所有寫入只改記憶體，重新整理頁面就會回到初始資料。
 * 真正的權限與資料範圍檢查必須在後端做，這裡不模擬。
 */
import { brands as seedBrands, plans as seedPlans, products as seedProducts } from './mock/brands';
import { customers as seedCustomers } from './mock/customers';
import { dealers as seedDealers } from './mock/dealers';
import { BILL_MONTHS, PAYMENT_DAYS, gcpBills as seedBills, googleInvoices as seedInvoices } from './mock/billing';
import { GCP_DAYS, GCP_PERIOD_END, gcpAccounts, gcpDates } from './mock/gcp';
import { auditLogs as seedLogs, roleOfActor } from './mock/logs';
import { roles as seedRoles } from './mock/roles';
import { schedules as seedSchedules } from './mock/schedules';
import { subscriptions as seedSubscriptions } from './mock/subscriptions';
import { users as seedUsers } from './mock/users';
import { operations as seedOperations } from './mock/operations';
import { workOrders as seedWorkOrders } from './mock/workOrders';
import { executionModeLabel, operationStatusLabel, operationTypeLabel, orgTypeLabel, transferSourceLabel, workOrderTypeLabel } from './labels';
import type {
  AuditLog,
  AuditLogQuery,
  Brand,
  BrandListItem,
  Customer,
  SalesAssignment,
  CustomerListItem,
  CustomerQuery,
  Dealer,
  DealerListItem,
  DomainCheck,
  GcpUsage,
  ProjectCost,
  BillDisplayStatus,
  BillMonth,
  BillQuery,
  GcpBill,
  GcpBillDetail,
  GcpBillListItem,
  ReconcileHow,
  ReconcileRow,
  ReconcileState,
  Reconciliation,
  LogCategory,
  LogResult,
  NewCustomerInput,
  NewUserInput,
  NewOperationInput,
  OperationAction,
  OperationListItem,
  OperationPayload,
  OperationStatus,
  OperationType,
  OrderAnalysis,
  ExecutionMode,
  Schedule,
  GwsOperation,
  WorkOrderInput,
  WorkOrderPayload,
  WorkOrderType,
  WorkOrderStep,
  WorkOrderStepState,
  OrgType,
  Plan,
  PlanListItem,
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
  User,
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

/** 目前登入者。由 login() 設定；頁面請用 getSession() 取得 */
export const currentUser = { id: '', name: '', role: '', roleId: '', email: '' };

const db = {
  dealers: structuredClone(seedDealers),
  customers: structuredClone(seedCustomers),
  subscriptions: structuredClone(seedSubscriptions),
  workOrders: structuredClone(seedWorkOrders),
  operations: structuredClone(seedOperations),
  schedules: structuredClone(seedSchedules),
  users: structuredClone(seedUsers),
  roles: structuredClone(seedRoles),
  logs: structuredClone(seedLogs),
  brands: structuredClone(seedBrands),
  products: structuredClone(seedProducts),
  plans: structuredClone(seedPlans),
  bills: structuredClone(seedBills),
  invoices: structuredClone(seedInvoices),
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

// ═════════ 登入 ═════════
// Prototype 不驗證密碼，只要有填就算正確。正式版的驗證、鎖定、重設密碼都由後端處理。

export interface Session {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: string;
  permissions: Role['permissions'];
}

const SESSION_KEY = 'zerone-admin-session';

function sessionOf(userId: string): Session | undefined {
  const u = db.users.find((x) => x.id === userId);
  const r = u && db.roles.find((x) => x.id === u.roleId);
  if (!u || !r) return undefined;
  return { id: u.id, name: u.name, email: u.email, roleId: r.id, role: r.name, permissions: r.permissions };
}

function setCurrent(s: Session | undefined) {
  Object.assign(currentUser, s ? { id: s.id, name: s.name, role: s.role, roleId: s.roleId, email: s.email } : { id: '', name: '', role: '', roleId: '', email: '' });
}

/** 重新整理頁面後恢復登入狀態（只存在這個分頁） */
export function getSession(): Session | undefined {
  if (!currentUser.id) {
    try {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (id) setCurrent(sessionOf(id));
    } catch {
      // 瀏覽器不允許存取 sessionStorage 時，就當作沒有登入
    }
  }
  return currentUser.id ? sessionOf(currentUser.id) : undefined;
}

export function login(email: string, password: string): Promise<Session> {
  const e = email.trim().toLowerCase();
  if (!e || !password) return fail('請輸入 Email 和密碼');
  const u = db.users.find((x) => x.email === e);
  if (!u) {
    log('login', e, '登入失敗：Email 或密碼不正確', 'warning', undefined, e);
    return fail('Email 或密碼不正確');
  }
  if (u.orgType !== 'internal') return fail(`這是${orgTypeLabel[u.orgType]}的帳號，請到${u.orgType === 'dealer' ? '經銷商端' : '客戶端'}登入`);
  if (u.status === 'disabled') {
    log('login', e, '登入失敗：帳號已停用', 'warning', undefined, u.name);
    return fail('這個帳號已停用，請聯絡系統管理員');
  }
  if (u.status === 'invited') return fail('這個帳號還沒啟用，請先從邀請信設定密碼');
  const s = sessionOf(u.id)!;
  setCurrent(s);
  u.lastLoginAt = now();
  try {
    sessionStorage.setItem(SESSION_KEY, u.id);
  } catch {
    // 忽略：只是重新整理後要重新登入
  }
  log('login', e, '登入管理端');
  return delay(s);
}

export function logout(): Promise<void> {
  if (currentUser.id) log('login', currentUser.email, '登出');
  setCurrent(undefined);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 忽略
  }
  return delay(undefined);
}

/** 不論 Email 是否存在都回覆相同訊息，避免被拿來測試帳號是否存在 */
export function requestPasswordReset(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  const u = db.users.find((x) => x.email === e && x.status === 'active');
  if (u) log('login', e, '申請重設密碼，已寄出重設信', 'success', undefined, u.name);
  return delay(undefined, 400);
}

/** Prototype 登入頁的測試帳號：零壹內部帳號，每個角色一個 */
export function getTestAccounts(): Promise<{ email: string; name: string; role: string; status: User['status'] }[]> {
  return delay(
    db.users
      .filter((u) => u.orgType === 'internal')
      .map((u) => ({ email: u.email, name: u.name, role: db.roles.find((r) => r.id === u.roleId)?.name ?? '', status: u.status })),
  );
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
    .filter((c) => includesKw(kw, c.name, c.primaryDomain, c.taxId, c.contactName, ...c.otherDomains, ...c.salesAssignments.map((a) => a.salesName)))
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
  const existing = db.customers.find((c) => c.primaryDomain === d || c.otherDomains.includes(d));
  if (existing) return { ok: false, reason: 'duplicate', message: `這個網域已被「${existing.name}」使用`, existingCustomer: existing.id };
  return { ok: true };
}

/** 新增客戶的其他網域（一個客戶可以有多個網域） */
export function addCustomerDomain(customerId: string, domain: string): Promise<CustomerListItem> {
  const c = customerOf(customerId);
  if (!c) return fail('找不到客戶');
  const check = checkDomain(domain);
  if (!check.ok) return fail(check.message);
  c.otherDomains.push(domain.trim());
  log('customer', c.name, `新增網域 ${domain.trim()}`, 'success', c.id);
  return delay(withDealer(c));
}

export function removeCustomerDomain(customerId: string, domain: string): Promise<CustomerListItem> {
  const c = customerOf(customerId);
  if (!c) return fail('找不到客戶');
  c.otherDomains = c.otherDomains.filter((d) => d !== domain);
  log('customer', c.name, `移除網域 ${domain}`, 'success', c.id);
  return delay(withDealer(c));
}

/** 可以指定為負責業務的內部帳號（業務、業務主管） */
export function getSalesPeople(): Promise<string[]> {
  return delay(db.users.filter((u) => u.orgType === 'internal' && (u.roleId === 'R03' || u.roleId === 'R12') && u.status === 'active').map((u) => u.name));
}

/** 更新負責業務：依產品 × 新約／續約 */
export function saveSalesAssignments(customerId: string, assignments: SalesAssignment[]): Promise<CustomerListItem> {
  const c = customerOf(customerId);
  if (!c) return fail('找不到客戶');
  const clean = assignments.filter((a) => a.salesName);
  const keys = new Set(clean.map((a) => `${a.product}-${a.term}`));
  if (keys.size !== clean.length) return fail('同一個產品的新約或續約只能指定一位業務');
  c.salesAssignments = clean;
  log('customer', c.name, `更新負責業務：${clean.map((a) => `${a.product}${a.term === 'new' ? '新約' : '續約'} ${a.salesName}`).join('、') || '無'}`, 'success', c.id);
  return delay(withDealer(c));
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
    otherDomains: [],
    salesAssignments: [
      ...(input.salesNew ? [{ product: 'GWS' as const, term: 'new' as const, salesName: input.salesNew }] : []),
      ...(input.salesRenewal ? [{ product: 'GWS' as const, term: 'renewal' as const, salesName: input.salesRenewal }] : []),
    ],
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

/** 轉入客戶：從其他經銷商轉進來的新客戶，建立客戶主檔後建立一筆移轉，由後勤人工執行（客戶已在 Google 申請完移轉，不需要轉移碼） */
export async function createTransferInCustomer(
  input: NewCustomerInput & { memo: string; workOrderId?: string },
): Promise<{ customer: CustomerListItem; operation: OperationListItem }> {
  const customer = await createCustomer({ ...input, note: input.note || '由其他經銷商轉入' });
  // 依執行單轉入時，先把客戶接回執行單，再建立移轉（記錄來源單號）
  if (input.workOrderId) await linkCustomerToWorkOrder(input.workOrderId, customer.id);
  const operation = await createOperation({
    type: 'transfer',
    customerId: customer.id,
    workOrderId: input.workOrderId,
    payload: { transferSource: 'otherDealer', memo: input.memo.trim() || undefined },
  });
  return { customer, operation };
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

/** 一筆訂閱尚未結束的操作（已排程、待人工、送出中、手動待同步），加上最近一次失敗 */
function openOperations(subscriptionId: string) {
  const ops = db.operations.filter((o) => o.subscriptionId === subscriptionId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = ops.filter((o) => ['scheduled', 'pendingManual', 'submitted', 'manual'].includes(o.status));
  const lastFailed = ops.find((o) => o.status === 'failed' && !open.some((x) => x.type === o.type));
  return lastFailed ? [...open, lastFailed] : open;
}

function subscriptionListItem(s: Subscription): SubscriptionListItem {
  const c = customerOf(s.customerId)!;
  const open = openOperations(s.id);
  return {
    ...s,
    status: effectiveStatus(s),
    customerName: c.name,
    primaryDomain: c.primaryDomain,
    dealerId: c.dealerId,
    dealerName: dealerName(c.dealerId),
    openOperations: open.map((o) => ({ id: o.id, type: o.type, status: o.status })),
  };
}

export function getSubscriptions(query: SubscriptionQuery = {}): Promise<SubscriptionListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.subscriptions
    .filter((s) => !query.product || s.product === query.product)
    .map(subscriptionListItem)
    .filter((s) => !query.customerId || s.customerId === query.customerId)
    .filter((s) => !query.dealerId || s.dealerId === query.dealerId)
    .filter((s) => !query.status || s.status === query.status)
    .filter((s) => !query.plan || s.plan === query.plan)
    .filter((s) => includesKw(kw, s.customerName, s.primaryDomain, s.plan))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return delay(rows);
}

/** 上架中的 GWS 方案名稱，依等級由低到高 */
export function getSubscription(id: string): Promise<(SubscriptionListItem & { planTier: number; salesNew?: string; salesRenewal?: string }) | undefined> {
  const s = db.subscriptions.find((x) => x.id === id);
  if (!s) return delay(undefined);
  const c = customerOf(s.customerId)!;
  const sales = (term: 'new' | 'renewal') => c.salesAssignments.find((a) => a.product === s.product && a.term === term)?.salesName;
  return delay({ ...subscriptionListItem(s), planTier: planTier(s.plan), salesNew: sales('new'), salesRenewal: sales('renewal') });
}

export function getPlans(): Promise<string[]> {
  return delay(activeGwsPlans().map((p) => p.name));
}
const activeGwsPlans = () => db.plans.filter((p) => p.productId === 'P01' && p.status === 'active').sort((a, b) => a.tier - b.tier);
/** 方案等級；找不到回傳 0 */
export const planTier = (name?: string) => db.plans.find((p) => p.name === name)?.tier ?? 0;

// ═════════ GWS 訂單操作（排程執行／人工執行） ═════════
// 2026/11/10 會議：新訂（全新）排程、新訂（移轉）人工、續約升版或加人排程、續約減人人工、
// 續約降版待確認（先人工）、加購排程（只能加人，期間到舊合約結束日）、中途升版排程（待確認）。

/** 這個方案比目前的高、低或一樣 */
function planChangeOf(from?: string, to?: string): 'up' | 'down' | 'same' {
  const a = planTier(from);
  const b = planTier(to);
  return b > a ? 'up' : b < a ? 'down' : 'same';
}

/** 依類型與內容判斷執行方式；畫面（訂單對話框、執行單）與資料層用同一套規則 */
export function analyzeOrder(type: OperationType, sub: Pick<Subscription, 'plan' | 'seats' | 'expiresAt'> | undefined, payload: OperationPayload): OrderAnalysis {
  switch (type) {
    case 'new':
      return { execution: 'schedule', reasons: ['全新客戶的新訂由排程執行'], defaultDate: TODAY };
    case 'transfer':
      return {
        execution: 'manual',
        reasons: [payload.transferSource === 'selfPaid' ? '客戶自己刷卡、要轉進來，由後勤人工執行' : '從其他經銷商轉入，由後勤人工執行'],
      };
    case 'renewal': {
      const planChange = planChangeOf(sub?.plan, payload.plan ?? sub?.plan);
      const seatChange = (payload.seats ?? sub?.seats ?? 0) - (sub?.seats ?? 0);
      const start = sub ? addDays(sub.expiresAt, 1) : TODAY;
      const end = addDays(addMonths(start, payload.renewMonths ?? 12), -1);
      const reasons: string[] = [];
      let execution: ExecutionMode = 'schedule';
      let pendingId: OrderAnalysis['pendingId'];
      if (planChange === 'down') {
        execution = 'manual';
        pendingId = 17;
        reasons.push('降版能否排程還在等 Terry 確認，先由後勤人工執行');
      }
      if (seatChange < 0) {
        execution = 'manual';
        reasons.push('續約減人數由後勤人工執行');
      }
      if (execution === 'schedule') reasons.push(`排在舊合約到期隔天（${start.replace(/-/g, '/')}）自動續約`);
      return { execution, pendingId, planChange, seatChange, reasons, defaultDate: start, newStartsAt: start, newExpiresAt: end };
    }
    case 'addSeats':
      return { execution: 'schedule', reasons: [`加購只能加人，期間到舊合約結束日（${sub?.expiresAt.replace(/-/g, '/') ?? '—'}）`], defaultDate: TODAY };
    case 'upgrade':
      return {
        execution: 'schedule',
        pendingId: 16,
        planChange: planChangeOf(sub?.plan, payload.plan),
        reasons: ['合約未到期前升版，預計排程執行（能否自動排程待 Terry 確認）'],
        defaultDate: TODAY,
      };
  }
}

function describeOperation(op: { type: OperationType; subscriptionId?: string; payload: OperationPayload }): string {
  const sub = db.subscriptions.find((s) => s.id === op.subscriptionId);
  const p = op.payload;
  const fromPlan = p.fromPlan ?? sub?.plan ?? '';
  const fromSeats = p.fromSeats ?? sub?.seats ?? 0;
  switch (op.type) {
    case 'new':
      return `${p.plan} ${p.seats} 席`;
    case 'transfer':
      return transferSourceLabel[p.transferSource ?? 'otherDealer'];
    case 'renewal': {
      const plan = p.plan ?? fromPlan;
      const seats = p.seats ?? fromSeats;
      const change = plan !== fromPlan || seats !== fromSeats ? `${fromPlan} ${fromSeats} 席 → ${plan} ${seats} 席，` : `${plan} ${seats} 席，`;
      return `${change}續約 ${p.renewMonths ?? 12} 個月`;
    }
    case 'addSeats':
      return `加購 ${p.addSeats} 席（${fromSeats} → ${fromSeats + (p.addSeats ?? 0)}）`;
    case 'upgrade':
      return `${fromPlan} → ${p.plan}${p.addSeats ? `，加購 ${p.addSeats} 席（${fromSeats} → ${fromSeats + p.addSeats}）` : ''}`;
  }
}

function operationListItem(op: GwsOperation): OperationListItem {
  const c = customerOf(op.customerId)!;
  return { ...op, customerName: c.name, primaryDomain: c.primaryDomain, dealerName: dealerName(c.dealerId), summary: describeOperation(op) };
}

export function getOperation(id: string): Promise<OperationListItem | undefined> {
  const op = db.operations.find((o) => o.id === id);
  return delay(op ? operationListItem(op) : undefined);
}

export function getOperations(query: { customerId?: string; subscriptionId?: string; type?: OperationType } = {}): Promise<OperationListItem[]> {
  return delay(
    db.operations
      .filter((o) => !query.customerId || o.customerId === query.customerId)
      .filter((o) => !query.subscriptionId || o.subscriptionId === query.subscriptionId)
      .filter((o) => !query.type || o.type === query.type)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(operationListItem),
  );
}

/** 流水號 PREFIX-MMDD-NNN */
function nextId(prefix: string, ids: string[], at: string) {
  const head = `${prefix}-${at.slice(5, 7)}${at.slice(8, 10)}-`;
  const max = ids.filter((id) => id.startsWith(head)).reduce((m, id) => Math.max(m, Number(id.slice(-3))), 0);
  return `${head}${String(max + 1).padStart(3, '0')}`;
}

const OPEN_STATUSES: OperationStatus[] = ['scheduled', 'pendingManual', 'submitted', 'manual'];
const isOpen = (o: GwsOperation) => OPEN_STATUSES.includes(o.status);

/** 這個客戶（網域）目前等待執行的排程，加購時用來提醒排程衝突 */
export function getPendingSchedules(customerId: string): Promise<ScheduleListItem[]> {
  return getSchedules({ status: 'waiting' }).then((rows) => rows.filter((s) => s.customerId === customerId).sort((a, b) => a.enabledAt.localeCompare(b.enabledAt)));
}

/** 檢查操作內容，回傳錯誤訊息（沒有錯誤回傳 undefined） */
export function validateOperation(input: NewOperationInput): string | undefined {
  const sub = db.subscriptions.find((s) => s.id === input.subscriptionId);
  const p = input.payload;
  if (input.type !== 'new' && input.type !== 'transfer') {
    if (!sub) return '找不到訂閱';
    if (sub.status === 'cancelled') return '這筆訂閱已取消';
    const same = db.operations.find((o) => o.subscriptionId === sub.id && isOpen(o) && o.type === input.type);
    if (same) return `這筆訂閱已有處理中的${operationTypeLabel[same.type]} ${same.id}`;
  }
  const activePlans = activeGwsPlans().map((x) => x.name);
  if (input.type === 'new') {
    if (!p.plan || !activePlans.includes(p.plan)) return '請選擇方案';
    if (!Number.isInteger(Number(p.seats)) || Number(p.seats) < 1) return '席次至少 1';
  }
  if (input.type === 'renewal') {
    if (!p.plan || !activePlans.includes(p.plan)) return '請選擇續約方案';
    if (!Number.isInteger(Number(p.seats)) || Number(p.seats) < 1) return '人數需為大於 0 的整數';
  }
  if (input.type === 'addSeats' && (!Number.isInteger(Number(p.addSeats)) || Number(p.addSeats) < 1)) return '加購人數需為大於 0 的整數，加購不能減人';
  if (input.type === 'upgrade' && p.addSeats !== undefined && (!Number.isInteger(Number(p.addSeats)) || Number(p.addSeats) < 0)) return '加購人數需為 0 以上的整數，升版不能減人';
  if (input.type === 'upgrade' && planChangeOf(sub?.plan, p.plan) !== 'up') return '中途升版只能選比目前高的方案';
  if (p.scheduledAt && p.scheduledAt < TODAY) return '啟用日不能早於今天';
  if (input.type === 'transfer') {
    if (!p.transferSource) return '請選擇轉入來源';
    const open = db.operations.find((o) => o.customerId === input.customerId && o.type === 'transfer' && isOpen(o));
    if (open) return `這個客戶已有處理中的客戶轉入 ${open.id}`;
  }
  return undefined;
}

const scheduleActionOf: Record<OperationType, Schedule['action'] | undefined> = {
  new: 'new',
  transfer: undefined,
  renewal: 'renew',
  addSeats: 'addSeats',
  upgrade: 'upgrade',
};

/** 建立訂單操作：排程執行的建立排程，人工執行的進入「待人工執行」 */
export function createOperation(input: NewOperationInput): Promise<OperationListItem> {
  const c = customerOf(input.customerId);
  if (!c) return fail('找不到客戶');
  const error = validateOperation(input);
  if (error) return fail(error);
  const sub = db.subscriptions.find((s) => s.id === input.subscriptionId);
  const analysis = analyzeOrder(input.type, sub, input.payload);
  const at = now();
  const payload: OperationPayload = { ...input.payload };
  if (sub) Object.assign(payload, { fromPlan: sub.plan, fromSeats: sub.seats ?? 0 });
  if (input.type === 'renewal') Object.assign(payload, { newStartsAt: analysis.newStartsAt, newExpiresAt: analysis.newExpiresAt });
  if (analysis.execution === 'schedule') payload.scheduledAt = payload.scheduledAt ?? analysis.defaultDate ?? TODAY;
  else delete payload.scheduledAt;
  const op: GwsOperation = {
    id: nextId('OP', db.operations.map((o) => o.id), at),
    type: input.type,
    customerId: c.id,
    subscriptionId: input.subscriptionId,
    workOrderId: input.workOrderId,
    payload,
    execution: analysis.execution,
    status: analysis.execution === 'schedule' ? 'scheduled' : 'pendingManual',
    createdBy: currentUser.name,
    createdAt: at,
    updatedAt: at,
    history: [],
  };
  if (analysis.execution === 'schedule') {
    const jid = `J${String(Math.max(0, ...db.schedules.map((x) => Number(x.id.slice(1)))) + 1).padStart(3, '0')}`;
    db.schedules.push({
      id: jid,
      kind: 'once',
      action: scheduleActionOf[op.type] ?? 'sync',
      status: 'waiting',
      enabledAt: `${payload.scheduledAt} 00:00`,
      customerId: c.id,
      subscriptionId: op.subscriptionId,
      operationId: op.id,
      detail: describeOperation(op),
      createdBy: currentUser.name,
    });
    op.scheduleId = jid;
    op.history.push({ at, by: currentUser.name, action: `建立排程 ${jid}，${payload.scheduledAt!.replace(/-/g, '/')} 執行`, status: 'scheduled' });
  } else {
    op.history.push({ at, by: currentUser.name, action: '建立，待後勤人工執行', status: 'pendingManual', note: analysis.reasons.join('；') });
  }
  db.operations.push(op);
  log(
    'gws',
    op.id,
    `${operationTypeLabel[op.type]}（${executionModeLabel[op.execution]}）：${describeOperation(op)}${op.workOrderId ? `（${op.workOrderId}）` : ''}`,
    'success',
    c.id,
  );
  if (op.workOrderId) {
    const wo = db.workOrders.find((w) => w.id === op.workOrderId);
    if (wo) {
      wo.operationId = op.id;
      refreshWorkOrder(wo, at);
    }
  }
  return delay(operationListItem(op));
}

const operationTransitions: Record<OperationAction, { from: OperationStatus[]; to: OperationStatus; label: string; system?: boolean }> = {
  runSchedule: { from: ['scheduled'], to: 'submitted', label: '排程啟動，送出 Google', system: true },
  cancelSchedule: { from: ['scheduled'], to: 'cancelled', label: '取消排程' },
  simulateSuccess: { from: ['submitted'], to: 'completed', label: 'Google 回應完成', system: true },
  simulateFailure: { from: ['submitted'], to: 'failed', label: 'Google 回應失敗', system: true },
  retry: { from: ['failed'], to: 'submitted', label: '重新送出 Google' },
  completeManual: { from: ['pendingManual'], to: 'manual', label: '已在 Google 完成人工處理' },
  markManual: { from: ['failed'], to: 'manual', label: '改為在 Google 手動處理' },
  simulateSync: { from: ['manual'], to: 'completed', label: '同步確認完成', system: true },
};

export function actOnOperation(id: string, action: OperationAction, note?: string): Promise<OperationListItem> {
  const op = db.operations.find((o) => o.id === id);
  if (!op) return fail('找不到操作');
  const t = operationTransitions[action];
  if (!t.from.includes(op.status)) return fail('狀態已變更，請重新整理');
  if ((action === 'markManual' || action === 'completeManual') && !note?.trim()) return fail('請填寫在 Google 做了什麼');
  const at = now();
  const by = t.system ? '系統' : currentUser.name;
  let eventNote = note?.trim() || undefined;
  if (action === 'simulateFailure') {
    op.failureReason = eventNote ?? '請求參數不正確';
    eventNote = op.failureReason;
  }
  if (action === 'retry') op.failureReason = undefined;
  if (action === 'markManual' || action === 'completeManual') op.manualNote = eventNote;
  op.status = t.to;
  op.updatedAt = at;
  op.history.push({ at, by, action: t.label, status: t.to, note: eventNote });
  const schedule = db.schedules.find((x) => x.id === op.scheduleId);
  if (schedule) {
    if (action === 'runSchedule') schedule.status = 'running';
    if (action === 'cancelSchedule') schedule.status = 'cancelled';
    if (t.to === 'completed') schedule.status = 'done';
    if (t.to === 'failed') schedule.status = 'failed';
  }
  log('gws', op.id, eventNote ? `${t.label}：${eventNote}` : t.label, t.to === 'failed' ? 'failure' : t.to === 'manual' ? 'warning' : 'success', op.customerId, by);
  if (t.to === 'completed') applyCompletedOperation(op, at);
  const wo = db.workOrders.find((w) => w.id === op.workOrderId);
  if (wo) refreshWorkOrder(wo, at);
  return delay(operationListItem(op));
}

/** 操作完成後，把結果寫回訂閱（模擬 Google 同步回來） */
function applyCompletedOperation(op: GwsOperation, at: string) {
  const sub = db.subscriptions.find((s) => s.id === op.subscriptionId);
  const c = customerOf(op.customerId)!;
  const p = op.payload;
  switch (op.type) {
    case 'addSeats':
      if (sub) sub.seats = (sub.seats ?? 0) + (p.addSeats ?? 0);
      break;
    case 'renewal':
      if (sub) {
        sub.plan = p.plan ?? sub.plan;
        sub.seats = p.seats ?? sub.seats;
        sub.startsAt = p.newStartsAt ?? addDays(sub.expiresAt, 1);
        sub.expiresAt = p.newExpiresAt ?? addMonths(sub.expiresAt, p.renewMonths ?? 12);
      }
      break;
    case 'upgrade':
      if (sub && p.plan) sub.plan = p.plan;
      if (sub && p.addSeats) sub.seats = (sub.seats ?? 0) + p.addSeats;
      break;
    case 'new': {
      const id = `S${String(db.subscriptions.length + 1).padStart(3, '0')}`;
      const start = p.scheduledAt ?? TODAY;
      db.subscriptions.push({
        id,
        customerId: c.id,
        product: 'GWS',
        plan: p.plan ?? 'Business Starter',
        seats: p.seats ?? 1,
        status: 'active',
        startsAt: start,
        expiresAt: addDays(addMonths(start, 12), -1),
        lastSyncedAt: at,
      });
      op.subscriptionId = id;
      break;
    }
    case 'transfer':
      log('customer', c.name, `客戶轉入完成（${op.id}），訂閱將於下次同步時出現在 GWS 訂閱清單`, 'success', c.id, '系統');
      break;
  }
  if (sub) sub.lastSyncedAt = at;
}

// ═════════ 執行單（業務需求單 → 簽核 → 後勤處理） ═════════

function workOrderCustomer(wo: WorkOrder) {
  const c = wo.customerId ? customerOf(wo.customerId) : undefined;
  return { name: c?.name ?? wo.newCustomer?.name ?? '', domain: c?.primaryDomain ?? wo.newCustomer?.primaryDomain ?? '' };
}

function describeWorkOrder(wo: WorkOrder): string {
  const text = describeOperation({ type: wo.type, subscriptionId: wo.subscriptionId, payload: wo.payload });
  return wo.type === 'transfer' ? `${workOrderCustomer(wo).name} 從其他經銷商轉入` : text;
}

const processable = (wo: WorkOrder) => wo.status === 'approved' || wo.status === 'processing' || wo.status === 'completed';

/** 核准後的處理步驟：新客戶要先建立客戶，再送 Google */
function workOrderSteps(wo: WorkOrder): WorkOrderStep[] {
  const steps: WorkOrderStep[] = [];
  const canWork = processable(wo);
  if (wo.customerMode === 'new') {
    steps.push({
      key: 'createCustomer',
      label: wo.type === 'transfer' ? '轉入客戶（建檔）' : '建立客戶',
      state: wo.customerId ? 'done' : canWork ? 'todo' : 'blocked',
      detail: wo.customerId ? `已建立 ${wo.customerId}` : undefined,
    });
  }
  const op = db.operations.find((o) => o.id === wo.operationId);
  const stateOf: Record<OperationStatus, WorkOrderStepState> = {
    scheduled: 'inProgress',
    pendingManual: 'manual',
    submitted: 'inProgress',
    completed: 'done',
    failed: 'failed',
    manual: 'manual',
    cancelled: 'todo',
  };
  const mode = executionModeLabel[op?.execution ?? analyzeOrder(wo.type, db.subscriptions.find((x) => x.id === wo.subscriptionId), wo.payload).execution];
  steps.push({
    key: 'google',
    label: `${operationTypeLabel[wo.type]}（${mode}）`,
    state: op ? stateOf[op.status] : canWork && wo.customerId ? 'todo' : 'blocked',
    detail: op ? `${op.id}・${operationStatusLabel[op.status]}${op.status === 'scheduled' && op.payload.scheduledAt ? `（${op.payload.scheduledAt.replace(/-/g, '/')}）` : ''}` : undefined,
  });
  return steps;
}

/** 依處理步驟更新執行單狀態：開始做任何一步就是「處理中」，全部完成就是「完成」 */
function refreshWorkOrder(wo: WorkOrder, at: string) {
  if (wo.status !== 'approved' && wo.status !== 'processing') return;
  const steps = workOrderSteps(wo);
  const started = steps.some((s) => s.state !== 'todo' && s.state !== 'blocked');
  if (wo.status === 'approved' && started) {
    wo.status = 'processing';
    wo.history.push({ at, by: currentUser.name, action: '開始處理', status: 'processing' });
  }
  if (steps.every((s) => s.state === 'done')) {
    wo.status = 'completed';
    wo.history.push({ at, by: '系統', action: '所有步驟完成', status: 'completed' });
    log('workOrder', wo.id, '所有步驟完成', 'success', wo.customerId, '系統');
  }
  wo.updatedAt = at;
}

function workOrderListItem(wo: WorkOrder): WorkOrderListItem {
  const c = workOrderCustomer(wo);
  const op = db.operations.find((o) => o.id === wo.operationId);
  return {
    ...wo,
    customerName: c.name,
    primaryDomain: c.domain,
    dealerName: dealerName(wo.dealerId),
    summary: describeWorkOrder(wo),
    steps: workOrderSteps(wo),
    operation: op ? operationListItem(op) : undefined,
  };
}

export function getWorkOrders(query: WorkOrderQuery = {}): Promise<WorkOrderListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.workOrders
    .filter((w) => !query.type || w.type === query.type)
    .filter((w) => !query.status || w.status === query.status)
    .filter((w) => !query.dealerId || w.dealerId === query.dealerId)
    .filter((w) => !query.customerId || w.customerId === query.customerId)
    .filter((w) => !query.subscriptionId || w.subscriptionId === query.subscriptionId)
    .map(workOrderListItem)
    .filter((w) => includesKw(kw, w.id, w.customerName, w.primaryDomain, w.summary, w.createdBy))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(rows);
}

export function getWorkOrder(id: string): Promise<WorkOrderListItem | undefined> {
  const wo = db.workOrders.find((w) => w.id === id);
  return delay(wo ? workOrderListItem(wo) : undefined);
}

/** 檢查執行單內容，回傳欄位錯誤（key 為欄位名稱） */
export function validateWorkOrder(input: WorkOrderInput, selfId?: string): Record<string, string> {
  const e: Record<string, string> = {};
  const needsSubscription = input.type === 'renewal' || input.type === 'addSeats' || input.type === 'upgrade';
  if (needsSubscription && input.customerMode === 'new') e.customerMode = '續約、加購、中途升版只適用現有客戶';
  if (input.type === 'transfer' && input.customerMode === 'existing') e.customerMode = '客戶轉入一定是新客戶';
  if (input.customerMode === 'existing' && !input.customerId) e.customerId = '請選擇客戶';
  if (needsSubscription && input.customerId && !input.subscriptionId) e.subscriptionId = '請選擇訂閱';
  if (input.customerMode === 'new') {
    const n = input.newCustomer;
    if (!n?.name.trim()) e.name = '請輸入客戶名稱';
    if (!/^\d{8}$/.test(n?.taxId ?? '')) e.taxId = '統一編號為 8 位數字';
    const d = checkDomain(n?.primaryDomain ?? '');
    if (!d.ok) e.primaryDomain = d.message;
    else {
      const other = db.workOrders.find(
        (w) => w.id !== selfId && w.customerMode === 'new' && !w.customerId && w.newCustomer?.primaryDomain === n?.primaryDomain.trim() && w.status !== 'completed',
      );
      if (other) e.primaryDomain = `執行單 ${other.id} 已經用這個網域開立新客戶`;
    }
    if (!n?.contactName.trim()) e.contactName = '請輸入聯絡人';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n?.contactEmail ?? '')) e.contactEmail = 'Email 格式不正確';
    if (!input.dealerId) e.dealerId = '請選擇經銷商';
  }
  const p = input.payload;
  const sub = db.subscriptions.find((x) => x.id === input.subscriptionId);
  if (input.type === 'new' || input.type === 'renewal' || input.type === 'upgrade') {
    if (!p.plan) e.plan = '請選擇方案';
  }
  if (input.type === 'new' || input.type === 'renewal') {
    if (!Number.isInteger(Number(p.seats)) || Number(p.seats) < 1) e.seats = '人數需為大於 0 的整數';
  }
  if (input.type === 'renewal' && !p.renewMonths) e.renewMonths = '請選擇續約期間';
  if (input.type === 'addSeats' && (!Number.isInteger(Number(p.addSeats)) || Number(p.addSeats) < 1)) e.addSeats = '加購人數需為大於 0 的整數';
  if (input.type === 'upgrade' && p.addSeats !== undefined && (!Number.isInteger(Number(p.addSeats)) || Number(p.addSeats) < 0)) e.addSeats = '加購人數需為 0 以上的整數';
  if (input.type === 'upgrade' && p.plan && sub && planChangeOf(sub.plan, p.plan) !== 'up') e.plan = '中途升版只能選比目前高的方案';
  return e;
}

function applyInput(wo: WorkOrder, input: WorkOrderInput) {
  const c = input.customerId ? customerOf(input.customerId) : undefined;
  wo.type = input.type;
  wo.customerMode = input.customerMode;
  wo.customerId = input.customerMode === 'existing' ? input.customerId : undefined;
  wo.newCustomer = input.customerMode === 'new' ? input.newCustomer : undefined;
  wo.dealerId = c?.dealerId ?? input.dealerId ?? 'D000';
  wo.subscriptionId = input.subscriptionId;
  const p = input.payload;
  const memo = p.memo?.trim() || undefined;
  // 只保留這個類型用得到的欄位
  const pick: Record<WorkOrderType, WorkOrderPayload> = {
    new: { plan: p.plan, seats: p.seats, memo },
    transfer: { transferSource: p.transferSource, memo },
    renewal: { plan: p.plan, seats: p.seats, renewMonths: p.renewMonths, memo },
    addSeats: { addSeats: p.addSeats, memo },
    upgrade: { plan: p.plan, addSeats: p.addSeats || undefined, memo },
  };
  wo.payload = pick[input.type];
}

/** 建立或修改執行單。submit 為 true 時直接送出簽核 */
export function saveWorkOrder(input: WorkOrderInput, submit: boolean, id?: string): Promise<WorkOrderListItem> {
  const errors = validateWorkOrder(input, id);
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  const at = now();
  let wo = id ? db.workOrders.find((w) => w.id === id) : undefined;
  if (id && !wo) return fail('找不到執行單');
  if (wo && wo.status !== 'draft' && wo.status !== 'returned') return fail('只有草稿或已退回的執行單可以修改');
  if (!wo) {
    wo = {
      id: nextId('WO', db.workOrders.map((w) => w.id), at),
      type: input.type,
      customerMode: input.customerMode,
      dealerId: 'D000',
      payload: {},
      status: 'draft',
      createdBy: currentUser.name,
      createdAt: at,
      updatedAt: at,
      history: [{ at, by: currentUser.name, action: '建立草稿', status: 'draft' }],
    };
    db.workOrders.push(wo);
    applyInput(wo, input);
    log('workOrder', wo.id, `開立${workOrderTypeLabel[wo.type]}執行單：${describeWorkOrder(wo)}`, 'success', wo.customerId);
  } else {
    applyInput(wo, input);
    wo.history.push({ at, by: currentUser.name, action: '修改內容', status: wo.status });
    log('workOrder', wo.id, '修改內容', 'success', wo.customerId);
  }
  wo.updatedAt = at;
  if (submit) {
    wo.status = 'salesReview';
    wo.returnReason = undefined;
    wo.history.push({ at, by: currentUser.name, action: '送出簽核', status: 'salesReview' });
    log('workOrder', wo.id, '送出簽核', 'success', wo.customerId);
  }
  return delay(workOrderListItem(wo));
}

/** 簽核角色：只有這兩個角色能核准或退回對應的關卡（後台管理員也不能代為核准） */
export const APPROVER_ROLE: Partial<Record<WorkOrder['status'], { roleId: string; roleName: string }>> = {
  salesReview: { roleId: 'R12', roleName: '業務主管' },
  techReview: { roleId: 'R13', roleName: '技術主管' },
};

/** 簽核流程：送出簽核、核准（業務主管 → 技術主管）、退回、刪除草稿 */
export function actOnWorkOrder(id: string, action: WorkOrderAction, note?: string): Promise<WorkOrderListItem | null> {
  const wo = db.workOrders.find((w) => w.id === id);
  if (!wo) return fail('找不到執行單');
  const at = now();
  const push = (status: WorkOrder['status'], label: string, n?: string, result: LogResult = 'success') => {
    wo.status = status;
    wo.updatedAt = at;
    wo.history.push({ at, by: currentUser.name, action: label, status, note: n });
    log('workOrder', wo.id, n ? `${label}：${n}` : label, result, wo.customerId);
  };
  switch (action) {
    case 'submit':
      if (wo.status !== 'draft' && wo.status !== 'returned') return fail('狀態已變更，請重新整理');
      wo.returnReason = undefined;
      push('salesReview', '送出簽核');
      break;
    case 'approve':
      if (APPROVER_ROLE[wo.status] && APPROVER_ROLE[wo.status]!.roleId !== currentUser.roleId) return fail(`只有${APPROVER_ROLE[wo.status]!.roleName}可以核准這一關`);
      if (wo.status === 'salesReview') push('techReview', '業務主管核准', note?.trim() || undefined);
      else if (wo.status === 'techReview') push('approved', '技術主管核准', note?.trim() || undefined);
      else return fail('狀態已變更，請重新整理');
      break;
    case 'return': {
      if (wo.status !== 'salesReview' && wo.status !== 'techReview') return fail('狀態已變更，請重新整理');
      if (APPROVER_ROLE[wo.status]!.roleId !== currentUser.roleId) return fail(`只有${APPROVER_ROLE[wo.status]!.roleName}可以退回這一關`);
      if (!note?.trim()) return fail('請填寫退回原因');
      const who = wo.status === 'salesReview' ? '業務主管' : '技術主管';
      wo.returnReason = note.trim();
      push('returned', `${who}退回`, note.trim(), 'warning');
      break;
    }
    case 'discard':
      if (wo.status !== 'draft' && wo.status !== 'returned') return fail('只有草稿或已退回的執行單可以刪除');
      db.workOrders = db.workOrders.filter((w) => w.id !== id);
      log('workOrder', id, '刪除執行單', 'success', wo.customerId);
      return delay(null);
  }
  return delay(workOrderListItem(wo));
}

/** 後勤依執行單建立客戶後，把客戶接回執行單 */
export function linkCustomerToWorkOrder(workOrderId: string, customerId: string): Promise<WorkOrderListItem> {
  const wo = db.workOrders.find((w) => w.id === workOrderId);
  if (!wo) return fail('找不到執行單');
  if (!processable(wo) || wo.customerMode !== 'new') return fail('這張執行單目前不能建立客戶');
  const at = now();
  wo.customerId = customerId;
  log('workOrder', wo.id, `已依執行單建立客戶 ${customerId}`, 'success', customerId);
  refreshWorkOrder(wo, at);
  return delay(workOrderListItem(wo));
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
        byProject: projectBreakdown(c.id, costCents),
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

/** 把金額依「專案 × 服務」拆開，比例沿用最近一期帳單的費用明細，加總保證等於總額 */
function projectBreakdown(customerId: string, totalCents: number): ProjectCost[] {
  const bill = db.bills.filter((b) => b.customerId === customerId).sort((a, b) => b.month.localeCompare(a.month))[0];
  if (!bill) return [];
  const billTotal = bill.lines.reduce((s, l) => s + l.costCents, 0);
  const projects = groupByProject(bill.lines);
  let left = totalCents;
  return projects.map((p, i) => {
    const pc = i === projects.length - 1 ? left : Math.round((totalCents * p.costCents) / billTotal);
    left -= pc;
    let sLeft = pc;
    const services = p.services.map((sv, j) => {
      const c = j === p.services.length - 1 ? sLeft : Math.round((pc * sv.costCents) / p.costCents);
      sLeft -= c;
      return { service: sv.service, costCents: c };
    });
    return { project: p.project, costCents: pc, services };
  });
}

/** 費用明細依專案彙總，專案、服務都依金額由大到小 */
export function groupByProject(lines: { service: string; project: string; costCents: number }[]): ProjectCost[] {
  const map = new Map<string, ProjectCost>();
  for (const l of lines) {
    const p = map.get(l.project) ?? { project: l.project, costCents: 0, services: [] };
    p.costCents += l.costCents;
    const sv = p.services.find((x) => x.service === l.service);
    if (sv) sv.costCents += l.costCents;
    else p.services.push({ service: l.service, costCents: l.costCents });
    map.set(l.project, p);
  }
  return [...map.values()].map((p) => ({ ...p, services: p.services.sort((a, b) => b.costCents - a.costCents) })).sort((a, b) => b.costCents - a.costCents);
}

// ═════════ GCP 帳單 ═════════
// 流程：系統匯入 Billing 費用並計算 → 後勤上傳 Google 帳單對帳 → 確認並出帳 → 標記已收款。
// 「逾期」= 已出帳且今天超過付款期限。不開立發票。

export const BILL_PAYMENT_DAYS = PAYMENT_DAYS;

export function getBillMonths(): Promise<BillMonth[]> {
  return delay(BILL_MONTHS);
}

const exportCents = (b: GcpBill) => b.lines.reduce((s, l) => s + l.costCents, 0);
const billCost = (b: GcpBill) => exportCents(b) + b.adjustmentCents;
/** 應收 TWD：Google 費用 ×（1＋加成）× 匯率，四捨五入到元 */
export const billAmountTwd = (costCents: number, markupPct: number, rate: number) => Math.round(((costCents * (100 + markupPct)) / 100 / 100) * rate);
const displayStatus = (b: GcpBill): BillDisplayStatus => (b.status === 'billed' && b.dueDate && b.dueDate < TODAY ? 'overdue' : b.status);

function reconcileOf(b: GcpBill): { state: ReconcileState; googleCents?: number } {
  const inv = db.invoices.find((i) => i.month === b.month);
  const googleCents = inv?.amounts[b.customerId];
  if (!inv || googleCents === undefined) return { state: 'noInvoice' };
  if (googleCents === exportCents(b)) return { state: 'match', googleCents };
  return { state: inv.resolutions[b.customerId] ? 'resolved' : 'mismatch', googleCents };
}

function toBillItem(b: GcpBill): GcpBillListItem {
  const c = customerOf(b.customerId)!;
  const costCents = billCost(b);
  return {
    ...b,
    customerName: c.name,
    dealerName: dealerName(c.dealerId),
    costCents,
    amountTwd: billAmountTwd(costCents, b.markupPct, b.rate),
    displayStatus: displayStatus(b),
    reconcile: reconcileOf(b).state,
  };
}

export function getGcpBills(query: BillQuery): Promise<GcpBillListItem[]> {
  const kw = normKw(query.keyword);
  const rows = db.bills
    .filter((b) => b.month === query.month)
    .map(toBillItem)
    .filter((b) => !query.dealerId || customerOf(b.customerId)?.dealerId === query.dealerId)
    .filter((b) => !query.status || b.displayStatus === query.status)
    .filter((b) => includesKw(kw, b.customerName, b.id))
    .sort((a, b) => b.costCents - a.costCents);
  return delay(rows);
}

/** 客戶詳情頁用：這個客戶所有月份的帳單 */
export function getCustomerBills(customerId: string): Promise<GcpBillListItem[]> {
  return delay(db.bills.filter((b) => b.customerId === customerId).map(toBillItem).sort((a, b) => b.month.localeCompare(a.month)));
}

export function getGcpBill(id: string): Promise<GcpBillDetail> {
  const b = db.bills.find((x) => x.id === id);
  if (!b) return fail('找不到這張帳單');
  const c = customerOf(b.customerId)!;
  return delay({ ...toBillItem(b), exportCents: exportCents(b), contactName: c.contactName, contactEmail: c.contactEmail, googleCents: reconcileOf(b).googleCents });
}

const billOrFail = (id: string) => {
  const b = db.bills.find((x) => x.id === id);
  if (!b) throw new Error('找不到這張帳單');
  return b;
};
const billEvent = (b: GcpBill, text: string) => b.history.unshift({ at: now(), actor: currentUser.name, text });

/** 為什麼這張帳單還不能出帳；可以出帳回傳 undefined */
export function issueBlocker(b: Pick<GcpBillListItem, 'status' | 'reconcile'>): string | undefined {
  if (b.status !== 'pending') return '這張帳單已經出帳';
  if (b.reconcile === 'noInvoice') return '還沒上傳這個月的 Google 帳單，請先到「成本對帳」上傳並比對';
  if (b.reconcile === 'mismatch') return '和 Google 帳單的金額有差異，請先到「成本對帳」處理';
  return undefined;
}

export function updateBill(id: string, input: { markupPct: number; note: string }): Promise<void> {
  try {
    const b = billOrFail(id);
    if (b.status !== 'pending') return fail('已出帳的帳單不能修改');
    if (!Number.isFinite(input.markupPct) || input.markupPct < 0 || input.markupPct > 100) return fail('加成請填 0 到 100 之間的數字');
    const changes: string[] = [];
    if (input.markupPct !== b.markupPct) changes.push(`加成 ${b.markupPct}% → ${input.markupPct}%`);
    if ((input.note.trim() || undefined) !== b.note) changes.push('更新備註');
    if (!changes.length) return delay(undefined);
    b.markupPct = input.markupPct;
    b.note = input.note.trim() || undefined;
    billEvent(b, `調整帳單：${changes.join('、')}`);
    log('billing', b.id, `調整帳單：${changes.join('、')}`, 'success', b.customerId);
    return delay(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** 確認並出帳。不能出帳的會略過並回報原因 */
export function issueBills(ids: string[]): Promise<{ issued: string[]; skipped: { id: string; reason: string }[] }> {
  const issued: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const b = db.bills.find((x) => x.id === id);
    if (!b) continue;
    const reason = issueBlocker({ status: b.status, reconcile: reconcileOf(b).state });
    if (reason) {
      skipped.push({ id, reason });
      continue;
    }
    b.status = 'billed';
    b.issuedAt = TODAY;
    b.dueDate = addDays(TODAY, PAYMENT_DAYS);
    billEvent(b, '確認並出帳，帳單已寄給帳務聯絡人');
    log('billing', b.id, `確認並出帳，應收 ${billAmountTwd(billCost(b), b.markupPct, b.rate).toLocaleString('en-US')} TWD`, 'success', b.customerId);
    issued.push(id);
  }
  return delay({ issued, skipped });
}

export function markBillPaid(id: string, input: { paidAt: string; note: string }): Promise<void> {
  try {
    const b = billOrFail(id);
    if (b.status !== 'billed') return fail('只有已出帳的帳單可以標記收款');
    if (!input.paidAt) return fail('請填收款日期');
    if (input.paidAt > TODAY) return fail('收款日期不能晚於今天');
    if (b.issuedAt && input.paidAt < b.issuedAt) return fail('收款日期不能早於出帳日');
    b.status = 'paid';
    b.paidAt = input.paidAt;
    billEvent(b, `標記已收款（${input.paidAt.replace(/-/g, '/')}）${input.note.trim() ? `：${input.note.trim()}` : ''}`);
    log('billing', b.id, '標記已收款', 'success', b.customerId);
    return delay(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export function resendBill(id: string): Promise<void> {
  try {
    const b = billOrFail(id);
    if (b.status === 'pending') return fail('還沒出帳的帳單不能寄送');
    const c = customerOf(b.customerId)!;
    billEvent(b, `重新寄送帳單給 ${c.contactEmail}`);
    log('billing', b.id, '重新寄送帳單', 'success', b.customerId);
    return delay(undefined);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export function getReconciliation(month: string): Promise<Reconciliation> {
  const inv = db.invoices.find((i) => i.month === month);
  const rows: ReconcileRow[] = db.bills
    .filter((b) => b.month === month)
    .map((b) => {
      const { state, googleCents } = reconcileOf(b);
      const oursCents = exportCents(b);
      return {
        customerId: b.customerId,
        customerName: customerOf(b.customerId)!.name,
        billId: b.id,
        oursCents,
        googleCents,
        diffCents: googleCents === undefined ? 0 : googleCents - oursCents,
        state,
        resolution: inv?.resolutions[b.customerId],
      };
    })
    .sort((a, b) => b.oursCents - a.oursCents);
  return delay({ month, invoice: inv && { month: inv.month, fileName: inv.fileName, uploadedAt: inv.uploadedAt, uploadedBy: inv.uploadedBy }, rows });
}

/** 模擬上傳 Google 帳單：Prototype 不讀檔案內容，只更新上傳紀錄，比對結果維持假資料 */
export function uploadGoogleInvoice(month: string, fileName: string): Promise<void> {
  const inv = db.invoices.find((i) => i.month === month);
  if (!fileName) return fail('請選擇檔案');
  if (!inv) return fail('這個月份沒有 Google 帳單資料');
  inv.fileName = fileName;
  inv.uploadedAt = now();
  inv.uploadedBy = currentUser.name;
  log('billing', `${month} Google 帳單`, `上傳 Google 帳單（${fileName}）`);
  return delay(undefined);
}

export function resolveReconcile(month: string, customerId: string, input: { how: ReconcileHow; reason: string; note: string }): Promise<void> {
  const inv = db.invoices.find((i) => i.month === month);
  const b = db.bills.find((x) => x.month === month && x.customerId === customerId);
  if (!inv || !b) return fail('找不到對帳資料');
  if (reconcileOf(b).state !== 'mismatch') return fail('這筆已經處理過了');
  if (b.status !== 'pending') return fail('帳單已出帳，不能再調整');
  if (!input.reason) return fail('請選擇差異原因');
  if (!input.note.trim()) return fail('請填寫說明');
  const google = inv.amounts[customerId];
  inv.resolutions[customerId] = { ...input, note: input.note.trim(), by: currentUser.name, at: now() };
  const diff = google - exportCents(b);
  b.adjustmentCents = input.how === 'adoptGoogle' ? diff : 0;
  const diffText = `${diff > 0 ? '+' : '−'}${(Math.abs(diff) / 100).toFixed(2)} USD`;
  const howText = input.how === 'adoptGoogle' ? '採用 Google 金額' : '維持我方金額';
  billEvent(b, `對帳差異 ${diffText} 已處理：${howText}（${input.reason}）`);
  log('billing', b.id, `處理對帳差異 ${diffText}：${howText}`, 'success', customerId);
  return delay(undefined);
}

// ═════════ 排程 ═════════

export function getSchedules(query: ScheduleQuery = {}): Promise<ScheduleListItem[]> {
  const rows = db.schedules
    .filter((s) => !query.subscriptionId || s.subscriptionId === query.subscriptionId)
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
  const op = db.operations.find((o) => o.id === s.operationId && o.status === 'scheduled');
  if (op) return actOnOperation(op.id, 'cancelSchedule').then(() => undefined);
  s.status = 'cancelled';
  log('gws', id, '取消排程', 'success', s.customerId);
  return delay(undefined);
}

// ═════════ 到期通知 ═════════
// GWS 到期前 N 天寄信給負責續約的業務和後勤（2026/11/10 會議；天數待定 #18、是否第一階段待定 #7）

const OPS_NOTICE = { name: '何佩真', email: 'peichen.ho@zerone.example' };
const noticeSettings = { enabled: true, daysBefore: 30 };
const manualNotices: Record<string, string> = {};

export interface ExpiryNoticeRow {
  subscriptionId: string;
  customerId: string;
  customerName: string;
  primaryDomain: string;
  plan: string;
  seats: number | null;
  expiresAt: string;
  noticeDate: string;
  recipients: { name: string; email: string; role: string }[];
  /** 已寄出的時間；還沒寄是 undefined */
  sentAt?: string;
}

function noticeRows(): ExpiryNoticeRow[] {
  return db.subscriptions
    .filter((s) => s.product === 'GWS' && s.status !== 'cancelled')
    .map((s) => {
      const c = customerOf(s.customerId)!;
      const salesName = c.salesAssignments.find((a) => a.product === 'GWS' && a.term === 'renewal')?.salesName;
      const sales = db.users.find((u) => u.name === salesName);
      const noticeDate = addDays(s.expiresAt, -noticeSettings.daysBefore);
      const recipients = [
        ...(sales ? [{ name: sales.name, email: sales.email, role: '續約業務' }] : []),
        { ...OPS_NOTICE, role: '後勤' },
      ];
      const autoSent = noticeSettings.enabled && noticeDate <= TODAY && noticeDate >= addDays(TODAY, -45) ? `${noticeDate} 08:00` : undefined;
      return {
        subscriptionId: s.id,
        customerId: c.id,
        customerName: c.name,
        primaryDomain: c.primaryDomain,
        plan: s.plan,
        seats: s.seats,
        expiresAt: s.expiresAt,
        noticeDate,
        recipients,
        sentAt: manualNotices[s.id] ?? autoSent,
      };
    })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/** 一筆訂閱的到期通知（通知日、收件人、是否已寄出） */
export function getExpiryNoticeFor(subscriptionId: string): Promise<ExpiryNoticeRow | undefined> {
  return delay(noticeRows().find((r) => r.subscriptionId === subscriptionId));
}

export function getExpiryNotices(): Promise<{ settings: typeof noticeSettings; rows: ExpiryNoticeRow[] }> {
  return delay({ settings: noticeSettings, rows: noticeRows().filter((r) => r.expiresAt >= TODAY && r.expiresAt <= addDays(TODAY, 120)) });
}

export function saveExpiryNoticeSettings(input: { enabled: boolean; daysBefore: number }): Promise<void> {
  if (!Number.isInteger(input.daysBefore) || input.daysBefore < 1 || input.daysBefore > 180) return fail('天數請填 1 到 180 的整數');
  Object.assign(noticeSettings, input);
  log('sync', '到期通知', `${input.enabled ? '啟用' : '停用'}到期通知，到期前 ${input.daysBefore} 天寄出`);
  return delay(undefined);
}

export function sendExpiryNoticeNow(subscriptionId: string): Promise<void> {
  const r = noticeRows().find((x) => x.subscriptionId === subscriptionId);
  if (!r) return fail('找不到訂閱');
  manualNotices[subscriptionId] = now();
  log('sync', r.primaryDomain, `手動寄出到期通知給 ${r.recipients.map((x) => x.name).join('、')}`, 'success', r.customerId);
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
  const nextNo = db.roles.reduce((m, r) => Math.max(m, Number(r.id.slice(1))), 0) + 1;
  const created: Role = { ...role, name, id: `R${String(nextNo).padStart(2, '0')}` };
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
  log('catalog', n, '新增品牌');
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
  log('catalog', name, '新增產品');
  return delay(product);
}

// ═════════ 方案 ═════════

export function getPlanList(): Promise<PlanListItem[]> {
  return delay(
    db.plans
      .map((p) => {
        const product = db.products.find((x) => x.id === p.productId);
        return {
          ...p,
          productName: product?.name ?? '—',
          brandName: db.brands.find((b) => b.id === product?.brandId)?.name ?? '—',
          subscriptionCount: db.subscriptions.filter((s) => s.plan === p.name && s.status !== 'cancelled').length,
        };
      })
      .sort((a, b) => a.productId.localeCompare(b.productId) || a.tier - b.tier),
  );
}

export function savePlan(input: { id?: string; productId: string; name: string; tier: number; status: Plan['status'] }): Promise<Plan> {
  const name = input.name.trim();
  if (!name) return fail('請輸入方案名稱');
  if (!Number.isInteger(input.tier) || input.tier < 1) return fail('等級請填 1 以上的整數');
  if (db.plans.some((p) => p.name === name && p.productId === input.productId && p.id !== input.id)) return fail('同一個產品已有同名方案');
  const clash = db.plans.find((p) => p.productId === input.productId && p.tier === input.tier && p.id !== input.id);
  if (clash) return fail(`等級 ${input.tier} 已經是「${clash.name}」，同一個產品的等級不能重複`);
  const existing = db.plans.find((p) => p.id === input.id);
  if (existing) {
    if (existing.name !== name && db.subscriptions.some((s) => s.plan === existing.name)) return fail('已有訂閱使用這個方案，不能改名');
    Object.assign(existing, { name, tier: input.tier, status: input.status });
    log('catalog', name, `修改方案：等級 ${input.tier}、${input.status === 'active' ? '上架' : '草稿'}`);
    return delay(existing);
  }
  const plan: Plan = { id: `PL${String(db.plans.length + 1).padStart(2, '0')}`, productId: input.productId, name, tier: input.tier, status: input.status, createdAt: TODAY };
  db.plans.push(plan);
  log('catalog', name, `新增方案（等級 ${plan.tier}）`);
  return delay(plan);
}

// ═════════ 首頁 ═════════

export async function getDashboard() {
  const [subs, orders, ops, gcp] = await Promise.all([getSubscriptions({ product: 'GWS' }), getWorkOrders(), getOperations(), getGcpUsage()]);
  const live = subs.filter((s) => s.status !== 'cancelled');
  const count = (st: WorkOrder['status']) => orders.filter((o) => o.status === st).length;
  return {
    activeCustomers: db.customers.filter((c) => c.status === 'active').length,
    totalCustomers: db.customers.length,
    totalSeats: live.reduce((sum, s) => sum + (s.seats ?? 0), 0),
    liveSubscriptions: live.length,
    expiring: live.filter((s) => s.status === 'expiring'),
    expiringWithin60: live.filter((s) => daysUntil(s.expiresAt) <= 60),
    orderCounts: {
      draft: count('draft'),
      salesReview: count('salesReview'),
      techReview: count('techReview'),
      approved: count('approved'),
      processing: count('processing'),
      completed: count('completed'),
      returned: count('returned'),
    },
    recentOrders: orders.slice(0, 6),
    operationIssues: ops.filter((o) => o.status === 'failed' || o.status === 'manual' || o.status === 'submitted'),
    gcp,
  };
}

export { addDays };
