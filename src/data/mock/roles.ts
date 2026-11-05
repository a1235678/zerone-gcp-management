import type { PermissionLevel, ResourceKey, Role } from '../types';

// 預設角色名稱沿用羽昇平台的 8 個角色（handoff「角色與權限」）。內部預設角色清單之後再跟使用者確認。
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
): Record<ResourceKey, PermissionLevel> => ({ customers, subscriptions, workOrders, gcpUsage, accounts, roles, auditLogs, billing });

export const roles: Role[] = [
  { id: 'R01', name: '後台管理員', orgType: 'internal', orgId: null, isPreset: true, description: '零壹內部最高權限，可管理所有資料與帳號', permissions: P('write', 'write', 'write', 'write', 'write', 'write', 'write', 'write') },
  { id: 'R02', name: '財務', orgType: 'internal', orgId: null, isPreset: true, description: '查看訂閱與用量，處理帳單', permissions: P('read', 'read', 'read', 'read', 'none', 'none', 'read', 'write') },
  { id: 'R03', name: '銷售', orgType: 'internal', orgId: null, isPreset: true, description: '維護客戶資料、開立執行單', permissions: P('write', 'read', 'write', 'read', 'none', 'none', 'none', 'read') },
  { id: 'R04', name: '工作人員－產品管理', orgType: 'internal', orgId: null, isPreset: true, description: '維護訂閱與產品設定', permissions: P('read', 'write', 'write', 'read', 'none', 'none', 'read', 'none') },
  { id: 'R05', name: '工作人員－技術', orgType: 'internal', orgId: null, isPreset: true, description: '確認並送出執行單、處理同步問題', permissions: P('read', 'write', 'write', 'write', 'read', 'none', 'read', 'none') },
  { id: 'R06', name: '工作人員－業務', orgType: 'internal', orgId: null, isPreset: true, description: '維護客戶資料、開立執行單', permissions: P('write', 'read', 'write', 'read', 'none', 'none', 'none', 'none') },
  { id: 'R07', name: '工作人員－業務 PickUp', orgType: 'internal', orgId: null, isPreset: true, description: '查看客戶與執行單', permissions: P('read', 'read', 'read', 'none', 'none', 'none', 'none', 'none') },
  { id: 'R08', name: '組織管理員', orgType: 'dealer', orgId: null, isPreset: true, description: '經銷商的第一個帳號，由零壹建立；可管理自家帳號與角色', permissions: P('write', 'write', 'write', 'read', 'write', 'write', 'read', 'read') },
  { id: 'R09', name: '組織管理員', orgType: 'customer', orgId: null, isPreset: true, description: '客戶的第一個帳號，由零壹建立；可管理自家帳號與角色', permissions: P('read', 'read', 'read', 'read', 'write', 'write', 'read', 'read') },
  { id: 'R10', name: '帳務專員', orgType: 'dealer', orgId: 'D001', isPreset: false, description: '北辰資訊自建：只看訂閱與帳單', permissions: P('read', 'read', 'none', 'read', 'none', 'none', 'none', 'read') },
  { id: 'R11', name: 'IT 管理員', orgType: 'customer', orgId: 'C0002', isPreset: false, description: '禾豐食品自建：查看訂閱與執行單', permissions: P('read', 'read', 'read', 'none', 'read', 'none', 'none', 'none') },
];
