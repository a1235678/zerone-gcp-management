import type { PermissionLevel, ResourceKey, Role } from '../types';

// 零壹內部角色：後台管理員、業務、技術、PM、業務主管、技術主管、後勤（2026/11/06 與使用者確認）。
// 經銷商與客戶各有一個預設的「組織管理員」，其他角色由他們自建。
// 權限等級：none 禁止／read 唯讀／write 可編輯
const P = (
  customers: PermissionLevel,
  subscriptions: PermissionLevel,
  workOrders: PermissionLevel,
  gcpUsage: PermissionLevel,
  accounts: PermissionLevel,
  roles: PermissionLevel,
  auditLogs: PermissionLevel,
  billing: PermissionLevel,
): Omit<Record<ResourceKey, PermissionLevel>, 'dealers' | 'catalog' | 'schedules'> => ({ customers, subscriptions, workOrders, gcpUsage, accounts, roles, auditLogs, billing });

// 經銷商、品牌與產品、排程（後來加的三個資源）：[經銷商, 品牌與產品, 排程]
type Extra = [dealers: PermissionLevel, catalog: PermissionLevel, schedules: PermissionLevel];
const extra: Record<string, Extra> = {
  R01: ['write', 'write', 'write'], // 後台管理員
  R03: ['read', 'read', 'none'], // 業務
  R04: ['read', 'write', 'write'], // PM
  R05: ['read', 'read', 'write'], // 技術
  R12: ['write', 'read', 'read'], // 業務主管
  R13: ['read', 'read', 'write'], // 技術主管
  R14: ['read', 'read', 'write'], // 後勤
};

const base: (Omit<Role, 'permissions'> & { permissions: ReturnType<typeof P> })[] = [
  { id: 'R01', name: '後台管理員', orgType: 'internal', orgId: null, isPreset: true, description: '零壹內部最高權限，可管理所有資料與帳號', permissions: P('write', 'write', 'write', 'write', 'write', 'write', 'write', 'write') },
  { id: 'R03', name: '業務', orgType: 'internal', orgId: null, isPreset: true, description: '接客戶需求，維護客戶資料、開立執行單', permissions: P('write', 'read', 'write', 'read', 'none', 'none', 'none', 'read') },
  { id: 'R04', name: 'PM', orgType: 'internal', orgId: null, isPreset: true, description: '產品管理：維護品牌、產品與排程', permissions: P('read', 'write', 'write', 'read', 'none', 'none', 'read', 'none') },
  { id: 'R05', name: '技術', orgType: 'internal', orgId: null, isPreset: true, description: '處理 Google 送出與同步問題', permissions: P('read', 'write', 'write', 'write', 'read', 'none', 'read', 'none') },
  { id: 'R12', name: '業務主管', orgType: 'internal', orgId: null, isPreset: true, description: '執行單第一關簽核', permissions: P('write', 'read', 'write', 'read', 'none', 'none', 'read', 'read') },
  { id: 'R13', name: '技術主管', orgType: 'internal', orgId: null, isPreset: true, description: '執行單第二關簽核', permissions: P('read', 'write', 'write', 'write', 'read', 'none', 'read', 'none') },
  { id: 'R14', name: '後勤', orgType: 'internal', orgId: null, isPreset: true, description: '依核准的執行單建立客戶、送 Google；也可以直接操作訂閱；負責 GCP 出帳與收款', permissions: P('write', 'write', 'read', 'read', 'none', 'none', 'read', 'write') },
  { id: 'R08', name: '組織管理員', orgType: 'dealer', orgId: null, isPreset: true, description: '經銷商的第一個帳號，由零壹建立；可管理自家帳號與角色', permissions: P('write', 'write', 'write', 'read', 'write', 'write', 'read', 'read') },
  { id: 'R09', name: '組織管理員', orgType: 'customer', orgId: null, isPreset: true, description: '客戶的第一個帳號，由零壹建立；可管理自家帳號與角色', permissions: P('read', 'read', 'read', 'read', 'write', 'write', 'read', 'read') },
  { id: 'R10', name: '帳務專員', orgType: 'dealer', orgId: 'D001', isPreset: false, description: '北辰資訊自建：只看訂閱與帳單', permissions: P('read', 'read', 'none', 'read', 'none', 'none', 'none', 'read') },
  { id: 'R11', name: 'IT 管理員', orgType: 'customer', orgId: 'C0002', isPreset: false, description: '禾豐食品自建：查看訂閱與執行單', permissions: P('read', 'read', 'read', 'none', 'read', 'none', 'none', 'none') },
];

// 經銷商與客戶的角色：這三個資源只存在管理端，一律禁止
export const roles: Role[] = base.map((r) => {
  const [dealers, catalog, schedules] = extra[r.id] ?? ['none', 'none', 'none'];
  return { ...r, permissions: { ...r.permissions, dealers, catalog, schedules } };
});
