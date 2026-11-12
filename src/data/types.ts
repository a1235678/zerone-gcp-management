// 資料型別：依 docs/handoff.md「資料與欄位」。拿到 Terry 的 API 格式後在這裡對照調整。
// 時間字串格式：日期 'YYYY-MM-DD'，時間 'YYYY-MM-DD HH:mm'（台北時間）。

export type OrgType = 'internal' | 'dealer' | 'customer';

// ── 經銷商 ─────────────────────────────
export type DealerStatus = 'active' | 'suspended';
export interface Dealer {
  id: string;
  name: string;
  /** 「直銷（零壹）」也當作一個經銷商 */
  isDirect: boolean;
  status: DealerStatus;
  createdAt: string;
}
export interface DealerListItem extends Dealer {
  customerCount: number;
  /** 名下客戶 GWS 訂閱（未取消）席次總和 */
  totalSeats: number;
  accountCount: number;
}

// ── 客戶 ───────────────────────────────
export type CustomerStatus = 'active' | 'disabled';
/** Google 網域驗證：建立客戶後才檢查 */
export type DomainVerification = 'verified' | 'pending' | 'failed';
/** 客戶屬性（選項待確認） */
export type CustomerAttribute = 'enterprise' | 'government' | 'school' | 'nonprofit';
export interface Address {
  /** 國家／地區 */
  country: string;
  /** 縣市（台灣用選單，其他國家自由輸入） */
  city: string;
  /** 鄉鎮區 */
  district: string;
  /** 郵遞區號：台灣依鄉鎮區自動帶出 */
  postalCode: string;
  street: string;
}
export interface CustomerContact {
  name: string;
  title: string;
  email: string;
  phone: string;
}
/** 負責業務：依「產品／新約或續約」指定，同一客戶可以不同（2026/11/10 會議） */
export interface SalesAssignment {
  product: ProductCode;
  term: 'new' | 'renewal';
  salesName: string;
}
export interface Customer {
  id: string;
  attribute: CustomerAttribute;
  /** 公司全名 */
  name: string;
  /** 公司簡稱，可以有多個別名 */
  shortNames: string[];
  /** 這個客戶本身也是經銷商 */
  isDealer: boolean;
  /** 是經銷商時，對應「經銷商管理」裡的經銷商；名下有客戶就不能取消「是否為經銷商」 */
  dealerOrgId?: string;
  /** 登記地址（公司法定登記地） */
  registeredAddress: Address;
  contactAddress: Address;
  contactSameAsRegistered: boolean;
  /** 統一編號（8 碼） */
  taxId: string;
  primaryDomain: string;
  /** 主網域以外的其他網域（一個客戶可以有多個網域） */
  otherDomains: string[];
  salesAssignments: SalesAssignment[];
  /** 一般聯絡人（不一定有系統帳號） */
  contacts: CustomerContact[];
  dealerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdBy: string;
  createdAt: string;
  note: string;
  status: CustomerStatus;
  domainVerification: DomainVerification;
}
export interface CustomerListItem extends Customer {
  dealerName: string;
  /** 是經銷商時，名下的客戶數 */
  downstreamCount: number;
}
export interface CustomerQuery {
  keyword?: string;
  dealerId?: string;
  status?: CustomerStatus | '';
}
export interface NewCustomerInput {
  name: string;
  taxId: string;
  primaryDomain: string;
  dealerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note: string;
  adminName: string;
  adminEmail: string;
  attribute?: CustomerAttribute;
  shortNames?: string[];
  isDealer?: boolean;
  registeredAddress?: Address;
  contactAddress?: Address;
  contactSameAsRegistered?: boolean;
  /** GWS 新約、續約的負責業務 */
  salesNew?: string;
  salesRenewal?: string;
}
export type DomainCheck =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'format' | 'duplicate'; message: string; existingCustomer?: string };

// ── 訂閱 ───────────────────────────────
export type ProductCode = 'GWS' | 'GCP';
export type SubscriptionStatus = 'active' | 'expiring' | 'cancelled';
export interface Subscription {
  id: string;
  customerId: string;
  product: ProductCode;
  plan: string;
  /** GWS 才有席次 */
  seats: number | null;
  status: SubscriptionStatus;
  /** 目前合約起日 */
  startsAt: string;
  /** 目前合約迄日（到期日） */
  expiresAt: string;
  /** 已取消續約：客戶合約到期後不再續約（不寄到期通知） */
  renewalCancelled?: { at: string; by: string; note: string };
  lastSyncedAt: string;
}
export interface SubscriptionListItem extends Subscription {
  customerName: string;
  primaryDomain: string;
  dealerId: string;
  dealerName: string;
  /** 這筆訂閱尚未結束的操作（已排程、待人工、送出中、手動待同步），加上最近一次失敗的 */
  openOperations: { id: string; type: OperationType; status: OperationStatus }[];
}
export interface SubscriptionQuery {
  product?: ProductCode;
  customerId?: string;
  keyword?: string;
  dealerId?: string;
  status?: SubscriptionStatus | '';
  plan?: string;
}

// ── GWS 訂單操作（後勤直接處理的變更） ─────
/**
 * 2026/11/10 會議定案的訂單類型：
 * new 新訂（全新客戶）、transfer 新訂（移轉進來）、renewal 續約、addSeats 加購、upgrade 中途升版。
 * 不提供取消訂閱（2026/11/11 確認）；續約也不提供取消。
 */
export type OperationType = 'new' | 'transfer' | 'renewal' | 'addSeats' | 'upgrade';
/** 排程執行：到啟用時間由系統送 Google；人工執行：後勤在 Google 後台處理後回來標記 */
export type ExecutionMode = 'schedule' | 'manual';
/** selfPaid：客戶自己刷卡、要移轉進來；otherDealer：從其他經銷商移轉（需移轉 ID） */
export type TransferSource = 'selfPaid' | 'otherDealer';
/**
 * scheduled：已排程，等啟用時間
 * pendingManual：待人工執行
 * submitted：已送出 Google，等待回應
 * completed：完成
 * failed：Google 回應失敗，可以重試或改為手動
 * manual：已在 Google 手動處理，等下次同步確認
 * cancelled：已取消（取消排程）
 */
export type OperationStatus = 'scheduled' | 'pendingManual' | 'submitted' | 'completed' | 'failed' | 'manual' | 'cancelled';
export interface OperationPayload {
  /** 新訂、續約、中途升版的方案（續約、升版為變更後的方案） */
  plan?: string;
  /** 新訂的席次，或續約後的席次 */
  seats?: number;
  /** 加購的人數 */
  addSeats?: number;
  /** 送出當下的方案與席次（續約、加購、升版） */
  fromPlan?: string;
  fromSeats?: number;
  renewMonths?: number;
  /** 續約後的新合約起迄 */
  newStartsAt?: string;
  newExpiresAt?: string;
  /** 排程執行的啟用日 */
  scheduledAt?: string;
  transferSource?: TransferSource;
  memo?: string;
}
export interface HistoryEvent<S extends string> {
  at: string;
  by: string;
  action: string;
  status: S;
  note?: string;
}
export interface GwsOperation {
  id: string;
  type: OperationType;
  customerId: string;
  subscriptionId?: string;
  /** 由執行單發起時記錄來源 */
  workOrderId?: string;
  payload: OperationPayload;
  execution: ExecutionMode;
  /** 排程執行時在 GWS 排程中心建立的排程 */
  scheduleId?: string;
  status: OperationStatus;
  failureReason?: string;
  manualNote?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEvent<OperationStatus>[];
}
export interface OperationListItem extends GwsOperation {
  customerName: string;
  primaryDomain: string;
  dealerName: string;
  summary: string;
}
export interface NewOperationInput {
  type: OperationType;
  customerId: string;
  subscriptionId?: string;
  workOrderId?: string;
  payload: OperationPayload;
}
/** 一筆訂單依規則判斷出來的結果，畫面與資料層共用 */
export interface OrderAnalysis {
  execution: ExecutionMode;
  /** 執行方式還沒定案時，對應的待確認編號 */
  pendingId?: 16 | 17;
  planChange?: 'up' | 'down' | 'same';
  /** 續約後與目前的席次差 */
  seatChange?: number;
  /** 為什麼用這種執行方式 */
  reasons: string[];
  /** 排程執行的預設啟用日 */
  defaultDate?: string;
  newStartsAt?: string;
  newExpiresAt?: string;
}
export type OperationAction = 'runSchedule' | 'cancelSchedule' | 'simulateSuccess' | 'simulateFailure' | 'retry' | 'completeManual' | 'markManual' | 'simulateSync';

// ── 執行單（業務的需求單，簽核後由後勤處理） ─────
export type WorkOrderType = OperationType;
/** 草稿 → 業務審核中 → 技術審核中 → 待處理 → 處理中 → 完成；任一關卡可退回 */
export type WorkOrderStatus = 'draft' | 'salesReview' | 'techReview' | 'approved' | 'processing' | 'completed' | 'returned';
export interface NewCustomerDraft {
  name: string;
  taxId: string;
  primaryDomain: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note: string;
}
export interface WorkOrderPayload {
  plan?: string;
  seats?: number;
  addSeats?: number;
  renewMonths?: number;
  transferSource?: TransferSource;
  memo?: string;
}
export interface WorkOrder {
  id: string;
  type: WorkOrderType;
  /** 現有客戶：customerId；新客戶：newCustomer，建立客戶後會補上 customerId */
  customerMode: 'existing' | 'new';
  customerId?: string;
  newCustomer?: NewCustomerDraft;
  dealerId: string;
  subscriptionId?: string;
  payload: WorkOrderPayload;
  status: WorkOrderStatus;
  returnReason?: string;
  /** 處理步驟中的 Google 操作 */
  operationId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEvent<WorkOrderStatus>[];
}
export type WorkOrderStepState = 'todo' | 'done' | 'inProgress' | 'failed' | 'manual' | 'blocked';
export interface WorkOrderStep {
  key: 'createCustomer' | 'google';
  label: string;
  state: WorkOrderStepState;
  detail?: string;
}
export interface WorkOrderListItem extends WorkOrder {
  customerName: string;
  primaryDomain: string;
  dealerName: string;
  summary: string;
  steps: WorkOrderStep[];
  operation?: OperationListItem;
}
export interface WorkOrderQuery {
  keyword?: string;
  type?: WorkOrderType | '';
  status?: WorkOrderStatus | '';
  dealerId?: string;
  customerId?: string;
  subscriptionId?: string;
}
export interface WorkOrderInput {
  type: WorkOrderType;
  customerMode: 'existing' | 'new';
  customerId?: string;
  newCustomer?: NewCustomerDraft;
  dealerId?: string;
  subscriptionId?: string;
  payload: WorkOrderPayload;
}
export type WorkOrderAction = 'submit' | 'approve' | 'return' | 'discard';

// ── GCP 用量 ───────────────────────────
export interface GcpUsageRow {
  customerId: string;
  customerName: string;
  dealerName: string;
  projects: number;
  /** 美分，避免浮點誤差 */
  costCents: number;
  egressGb: number;
  /** 較前 30 天的變化（%） */
  changePct: number;
  /** 依專案彙總，可以往下看各服務的明細（2026/11/11 與 Ray 的會議） */
  byProject: ProjectCost[];
}
export interface ProjectCost {
  project: string;
  costCents: number;
  services: { service: string; costCents: number }[];
}
export interface GcpUsage {
  periodStart: string;
  periodEnd: string;
  totalCostCents: number;
  prevTotalCostCents: number;
  totalEgressGb: number;
  totalProjects: number;
  daily: { date: string; costCents: number }[];
  rows: GcpUsageRow[];
}

// ── GCP 帳單 ───────────────────────────
/** 存在資料裡的狀態；「逾期」由已出帳＋付款期限推算，不另外存 */
export type BillStatus = 'pending' | 'billed' | 'paid';
export type BillDisplayStatus = 'pending' | 'billed' | 'overdue' | 'paid';
export interface BillLine {
  service: string;
  project: string;
  costCents: number;
}
export interface BillEvent {
  at: string;
  actor: string;
  text: string;
}
export interface GcpBill {
  id: string;
  /** 帳單月份，例如 2026-10 */
  month: string;
  customerId: string;
  projects: number;
  /** Billing 匯出的費用明細（美分） */
  lines: BillLine[];
  /** 對帳時採用 Google 金額產生的成本調整（美分，可正可負） */
  adjustmentCents: number;
  markupPct: number;
  /** 1 USD 換多少 TWD */
  rate: number;
  status: BillStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  note?: string;
  history: BillEvent[];
}
export type ReconcileState = 'match' | 'mismatch' | 'resolved' | 'noInvoice';
export interface GcpBillListItem extends GcpBill {
  customerName: string;
  dealerName: string;
  /** 匯出費用＋調整（美分） */
  costCents: number;
  amountTwd: number;
  displayStatus: BillDisplayStatus;
  reconcile: ReconcileState;
}
export interface GcpBillDetail extends GcpBillListItem {
  exportCents: number;
  contactName: string;
  contactEmail: string;
  googleCents?: number;
}
export interface BillQuery {
  month: string;
  keyword?: string;
  dealerId?: string;
  status?: BillDisplayStatus | '';
}
export interface BillMonth {
  month: string;
  label: string;
  rate: number;
}
export type ReconcileHow = 'adoptGoogle' | 'keepOurs';
export interface ReconcileResolution {
  how: ReconcileHow;
  reason: string;
  note: string;
  by: string;
  at: string;
}
export interface GoogleInvoice {
  month: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  /** 各客戶（Google 帳務帳戶）的 Google 帳單金額（美分） */
  amounts: Record<string, number>;
  resolutions: Record<string, ReconcileResolution>;
}
export interface ReconcileRow {
  customerId: string;
  customerName: string;
  billId: string;
  oursCents: number;
  googleCents?: number;
  diffCents: number;
  state: ReconcileState;
  resolution?: ReconcileResolution;
}
export interface Reconciliation {
  month: string;
  invoice?: Omit<GoogleInvoice, 'amounts' | 'resolutions'>;
  rows: ReconcileRow[];
}

// ── 排程 ───────────────────────────────
export type ScheduleKind = 'once' | 'monthly' | 'yearly';
export type ScheduleAction = 'new' | 'addSeats' | 'renew' | 'upgrade' | 'sync';
export type ScheduleStatus = 'waiting' | 'running' | 'done' | 'failed' | 'cancelled';
export interface Schedule {
  id: string;
  kind: ScheduleKind;
  action: ScheduleAction;
  status: ScheduleStatus;
  /** 啟用時間 */
  enabledAt: string;
  customerId: string;
  subscriptionId?: string;
  /** 由訂單操作建立的排程 */
  operationId?: string;
  detail: string;
  createdBy: string;
}
export interface ScheduleListItem extends Schedule {
  customerName: string;
  primaryDomain: string;
  dealerName: string;
}
export interface ScheduleQuery {
  subscriptionId?: string;
  kind?: ScheduleKind | '';
  action?: ScheduleAction | '';
  status?: ScheduleStatus | '';
  from?: string;
  to?: string;
}

// ── 使用者與角色 ───────────────────────
export type UserStatus = 'active' | 'disabled' | 'invited';
export interface User {
  id: string;
  name: string;
  email: string;
  orgType: OrgType;
  /** internal 時為 'ZERONE' */
  orgId: string;
  roleId: string;
  status: UserStatus;
  /** 零壹建立的第一個組織管理員 */
  isFirstAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
export interface UserListItem extends User {
  orgName: string;
  roleName: string;
}
export interface UserQuery {
  keyword?: string;
  orgType?: OrgType | '';
  orgId?: string;
  roleId?: string;
  status?: UserStatus | '';
}
export interface NewUserInput {
  name: string;
  email: string;
  orgType: OrgType;
  orgId: string;
  roleId: string;
}

/** 禁止 < 唯讀 < 可編輯 < 可新增（可新增包含可編輯，2026/11/12） */
export type PermissionLevel = 'none' | 'read' | 'write' | 'create';
export type ResourceKey =
  | 'customers'
  | 'dealers'
  | 'workOrders'
  | 'catalog'
  | 'subscriptions'
  | 'gcpUsage'
  | 'schedules'
  | 'accounts'
  | 'roles'
  | 'auditLogs'
  | 'billing';
export interface Role {
  id: string;
  name: string;
  orgType: OrgType;
  /** 系統預設角色沒有 orgId；經銷商或客戶自建的角色有 */
  orgId: string | null;
  description: string;
  isPreset: boolean;
  permissions: Record<ResourceKey, PermissionLevel>;
}
export interface RoleListItem extends Role {
  orgName: string;
  userCount: number;
}

// ── 操作紀錄 ───────────────────────────
export type LogCategory = 'customer' | 'workOrder' | 'gws' | 'billing' | 'catalog' | 'permission' | 'login' | 'sync';
export type LogResult = 'success' | 'failure' | 'warning';
export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  actorRole: string;
  category: LogCategory;
  /** 對象，例如客戶名稱或單號 */
  target: string;
  /** 對象所屬客戶，用於客戶詳情頁篩選 */
  customerId?: string;
  action: string;
  result: LogResult;
}
export interface AuditLogQuery {
  keyword?: string;
  category?: LogCategory | '';
  result?: LogResult | '';
  customerId?: string;
  from?: string;
  to?: string;
}

// ── 品牌與產品（欄位待確認） ───────────
export interface Brand {
  id: string;
  name: string;
  status: 'active' | 'draft';
  createdAt: string;
}
export interface Product {
  id: string;
  brandId: string;
  name: string;
  code: string;
  status: 'active' | 'draft';
  createdAt: string;
}
/** 方案：等級數字越大版本越高，用來判斷升版、降版 */
export interface Plan {
  id: string;
  productId: string;
  name: string;
  tier: number;
  status: 'active' | 'draft';
  createdAt: string;
}
export interface PlanListItem extends Plan {
  productName: string;
  brandName: string;
  /** 使用中（未取消）的訂閱數 */
  subscriptionCount: number;
}
export interface BrandListItem extends Brand {
  productCount: number;
}
export interface ProductListItem extends Product {
  brandName: string;
}
