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
  BillDisplayStatus,
  ReconcileState,
  ReconcileHow,
  ScheduleAction,
  ScheduleKind,
  ScheduleStatus,
  SubscriptionStatus,
  UserStatus,
  WorkOrderStatus,
  WorkOrderType,
  OperationStatus,
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
export const operationTypeLabel = workOrderTypeLabel;

export const workOrderStatusLabel: Record<WorkOrderStatus, string> = {
  draft: '草稿',
  salesReview: '業務審核中',
  techReview: '技術審核中',
  approved: '待處理',
  processing: '處理中',
  completed: '完成',
  returned: '已退回',
};
/** 狀態示意條的順序（退回是審核關卡的分支） */
export const workOrderFlow: WorkOrderStatus[] = ['draft', 'salesReview', 'techReview', 'approved', 'processing', 'completed'];

export const operationStatusLabel: Record<OperationStatus, string> = {
  submitted: '已送出 Google',
  completed: '完成',
  failed: '失敗',
  manual: '手動處理・待同步確認',
};

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
  dealers: '經銷商',
  catalog: '品牌與產品',
  schedules: '排程',
  subscriptions: '訂閱',
  workOrders: '執行單',
  gcpUsage: 'GCP 用量',
  accounts: '帳號',
  roles: '角色',
  auditLogs: '系統日誌',
  billing: '帳單',
};
/** 順序與左側選單一致 */
export const resourceOrder: ResourceKey[] = ['customers', 'dealers', 'workOrders', 'catalog', 'subscriptions', 'gcpUsage', 'schedules', 'accounts', 'roles', 'auditLogs', 'billing'];

export const logCategoryLabel: Record<LogCategory, string> = {
  customer: '客戶資料',
  workOrder: '執行單',
  gws: 'GWS 操作',
  billing: '帳單',
  permission: '權限',
  login: '登入',
  sync: '同步',
};
export const logResultLabel: Record<LogResult, string> = { success: '成功', failure: '失敗', warning: '警示' };

export const billStatusLabel: Record<BillDisplayStatus, string> = { pending: '待確認', billed: '已出帳', overdue: '逾期', paid: '已收款' };
export const reconcileStateLabel: Record<ReconcileState, string> = { match: '一致', mismatch: '有差異', resolved: '已處理', noInvoice: '尚無 Google 帳單' };
export const reconcileHowLabel: Record<ReconcileHow, string> = { adoptGoogle: '採用 Google 金額', keepOurs: '維持我方金額' };
/** 對帳差異的常見原因，處理差異時選一個 */
export const reconcileReasons = ['折抵或促銷額度', '費用資料晚到', 'Google 事後調整或退費', '稅金或四捨五入', '其他'];
