// 各種代碼的中文名稱。畫面上的文字一律從這裡取，之後對照 API 時只改這一份。
import type {
  CustomerStatus,
  DealerStatus,
  DomainVerification,
  LogCategory,
  LogResult,
  OrgType,
  PermissionLevel,
  ResourceKey,
  ScheduleAction,
  ScheduleKind,
  ScheduleStatus,
  SubscriptionStatus,
  UserStatus,
  WorkOrderStatus,
  WorkOrderType,
} from './types';

export const orgTypeLabel: Record<OrgType, string> = { internal: '內部', dealer: '經銷商', customer: '客戶' };
export const dealerStatusLabel: Record<DealerStatus, string> = { active: '合作中', suspended: '已暫停' };
export const customerStatusLabel: Record<CustomerStatus, string> = { active: '啟用', disabled: '停用' };
export const domainVerificationLabel: Record<DomainVerification, string> = { verified: '已驗證', pending: '待驗證', failed: '驗證失敗' };
export const subscriptionStatusLabel: Record<SubscriptionStatus, string> = { active: '使用中', expiring: '即將到期', cancelled: '已取消' };

export const workOrderTypeLabel: Record<WorkOrderType, string> = {
  new: '新訂閱',
  renewal: '續約',
  seats: '調整席次',
  transfer: '客戶轉移',
  cancel: '取消訂閱',
};
export const workOrderStatusLabel: Record<WorkOrderStatus, string> = {
  draft: '草稿',
  pending: '待確認',
  submitted: '已送出 Google',
  completed: '完成',
  failed: '失敗',
};
/** 狀態流程的順序（失敗是「已送出 Google」之後的分支） */
export const workOrderFlow: WorkOrderStatus[] = ['draft', 'pending', 'submitted', 'completed'];

export const scheduleKindLabel: Record<ScheduleKind, string> = { once: '單次', monthly: '每月', yearly: '每年' };
export const scheduleActionLabel: Record<ScheduleAction, string> = {
  addSeats: '增加席次',
  removeSeats: '減少席次',
  renew: '續約',
  cancel: '取消訂閱',
  sync: '同步訂閱資料',
};
export const scheduleStatusLabel: Record<ScheduleStatus, string> = {
  waiting: '等待執行',
  running: '執行中',
  done: '已完成',
  failed: '失敗',
  cancelled: '已取消',
};

export const userStatusLabel: Record<UserStatus, string> = { active: '啟用', disabled: '停用', invited: '已邀請' };
export const permissionLabel: Record<PermissionLevel, string> = { none: '禁止', read: '唯讀', write: '可編輯' };
export const resourceLabel: Record<ResourceKey, string> = {
  customers: '客戶',
  subscriptions: '訂閱',
  workOrders: '執行單',
  gcpUsage: 'GCP 用量',
  accounts: '帳號',
  roles: '角色',
  auditLogs: '系統日誌',
  billing: '帳單',
};
export const resourceOrder: ResourceKey[] = ['customers', 'subscriptions', 'workOrders', 'gcpUsage', 'accounts', 'roles', 'auditLogs', 'billing'];

export const logCategoryLabel: Record<LogCategory, string> = {
  customer: '客戶資料',
  workOrder: '執行單',
  permission: '權限',
  login: '登入',
  sync: '同步',
};
export const logResultLabel: Record<LogResult, string> = { success: '成功', failure: '失敗', warning: '警示' };
