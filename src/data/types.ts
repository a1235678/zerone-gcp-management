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
export interface Customer {
  id: string;
  name: string;
  /** 統一編號（8 碼） */
  taxId: string;
  primaryDomain: string;
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
  expiresAt: string;
  lastSyncedAt: string;
}
export interface SubscriptionListItem extends Subscription {
  customerName: string;
  primaryDomain: string;
  dealerId: string;
  dealerName: string;
  /** 這筆訂閱目前有沒有送出中（或待處理）的 Google 操作 */
  openOperationId?: string;
  openOperationStatus?: OperationStatus;
}
export interface SubscriptionQuery {
  product?: ProductCode;
  customerId?: string;
  keyword?: string;
  dealerId?: string;
  status?: SubscriptionStatus | '';
  plan?: string;
}

// ── GWS 操作（後勤直接送 Google 的變更） ─────
export type OperationType = 'new' | 'renewal' | 'seats' | 'transfer' | 'cancel';
/**
 * submitted：已送出 Google，等待回應
 * completed：完成
 * failed：Google 回應失敗，可以重試或改為手動
 * manual：改為在 Google 手動處理，等下次同步確認
 */
export type OperationStatus = 'submitted' | 'completed' | 'failed' | 'manual';
export interface OperationPayload {
  plan?: string;
  seats?: number;
  fromSeats?: number;
  toSeats?: number;
  renewMonths?: number;
  transferToken?: string;
  tokenExpiresAt?: string;
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
export type OperationAction = 'simulateSuccess' | 'simulateFailure' | 'retry' | 'markManual' | 'simulateSync';

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
  toSeats?: number;
  renewMonths?: number;
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

// ── 排程 ───────────────────────────────
export type ScheduleKind = 'once' | 'monthly' | 'yearly';
export type ScheduleAction = 'addSeats' | 'removeSeats' | 'renew' | 'cancel' | 'sync';
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
  detail: string;
  createdBy: string;
}
export interface ScheduleListItem extends Schedule {
  customerName: string;
  primaryDomain: string;
  dealerName: string;
}
export interface ScheduleQuery {
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

export type PermissionLevel = 'none' | 'read' | 'write';
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
export type LogCategory = 'customer' | 'workOrder' | 'gws' | 'permission' | 'login' | 'sync';
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
export interface BrandListItem extends Brand {
  productCount: number;
}
export interface ProductListItem extends Product {
  brandName: string;
}
