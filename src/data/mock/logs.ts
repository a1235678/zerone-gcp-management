import type { AuditLog } from '../types';
import { workOrders } from './workOrders';

// 操作紀錄：執行單的每一步都由歷程產生，其他事件手動列出
const actorRole: Record<string, string> = {
  林怡君: '後台管理員',
  黃柏翰: '銷售',
  陳思穎: '財務',
  張家銘: '工作人員－技術',
  王雅琪: '工作人員－產品管理',
  李冠霖: '工作人員－業務',
  周文彬: '組織管理員（北辰資訊）',
  潘俐君: '組織管理員（青嶼雲端）',
  系統: '系統',
};
export const roleOfActor = (name: string) => actorRole[name] ?? '—';

const fromWorkOrders: Omit<AuditLog, 'id'>[] = workOrders.flatMap((wo) =>
  wo.history.map((ev) => ({
    at: ev.at,
    actor: ev.by,
    actorRole: roleOfActor(ev.by),
    category: 'workOrder' as const,
    target: wo.id,
    customerId: wo.customerId,
    action: ev.note ? `${ev.action}：${ev.note}` : ev.action,
    result: ev.status === 'failed' ? ('failure' as const) : ('success' as const),
  })),
);

const manual: Omit<AuditLog, 'id'>[] = [
  { at: '2026-11-05 08:52', actor: '林怡君', actorRole: '後台管理員', category: 'login', target: 'yijun.lin@zerone.example', action: '登入管理端', result: 'success' },
  { at: '2026-11-05 08:47', actor: '吳承澤', actorRole: '工作人員－業務 PickUp', category: 'login', target: 'chengtse.wu@zerone.example', action: '登入失敗：帳號已停用', result: 'warning' },
  { at: '2026-11-05 06:04', actor: '系統', actorRole: '系統', category: 'sync', target: 'GWS 訂閱', action: '每日同步完成：27 筆訂閱', result: 'success' },
  { at: '2026-11-05 06:04', actor: '系統', actorRole: '系統', category: 'sync', target: 'yunshan-cpa.example', customerId: 'C0010', action: '同步失敗：Google 回應逾時，沿用前一次資料', result: 'warning' },
  { at: '2026-11-04 17:10', actor: '周文彬', actorRole: '組織管理員（北辰資訊）', category: 'permission', target: '帳務專員', action: '修改角色權限：帳單 改為 唯讀', result: 'success' },
  { at: '2026-11-03 11:30', actor: '方靜怡', actorRole: '組織管理員（藍橋數位整合）', category: 'permission', target: 'pm@lanqiao-digital.example', action: '邀請新帳號', result: 'success' },
  { at: '2026-11-03 10:31', actor: '系統', actorRole: '系統', category: 'customer', target: '白鷺鷥文創', customerId: 'C0023', action: '客戶轉入完成，經銷商：青嶼雲端', result: 'success' },
  { at: '2026-10-28 09:15', actor: '黃柏翰', actorRole: '銷售', category: 'customer', target: '白鷺鷥文創', customerId: 'C0023', action: '新增客戶（egret-creative.example）', result: 'success' },
  { at: '2026-10-19 15:02', actor: '黃柏翰', actorRole: '銷售', category: 'customer', target: '曉風出版社', customerId: 'C0027', action: '新增客戶（xiaofeng-press.example）', result: 'success' },
  { at: '2026-10-19 15:02', actor: '系統', actorRole: '系統', category: 'customer', target: 'xiaofeng-press.example', customerId: 'C0027', action: 'Google 網域驗證通過', result: 'success' },
  { at: '2026-09-12 09:00', actor: '林怡君', actorRole: '後台管理員', category: 'permission', target: '森和系統', action: '暫停經銷商，停用 1 個帳號', result: 'warning' },
  { at: '2026-09-08 14:20', actor: '黃柏翰', actorRole: '銷售', category: 'customer', target: '新創合作社', customerId: 'C0026', action: '新增客戶（coop-lab.example）', result: 'success' },
  { at: '2026-09-08 14:25', actor: '系統', actorRole: '系統', category: 'customer', target: 'coop-lab.example', customerId: 'C0026', action: 'Google 網域驗證未通過：找不到驗證 TXT 記錄', result: 'warning' },
  { at: '2026-10-30 10:40', actor: '林怡君', actorRole: '後台管理員', category: 'customer', target: '松濤律師事務所', customerId: 'C0015', action: '停用客戶', result: 'success' },
  { at: '2026-10-02 10:10', actor: '林怡君', actorRole: '後台管理員', category: 'customer', target: '福川精密工業', customerId: 'C0009', action: '停用客戶', result: 'success' },
  { at: '2026-11-04 17:40', actor: '陳思穎', actorRole: '財務', category: 'login', target: 'szuying.chen@zerone.example', action: '登入管理端', result: 'success' },
  { at: '2026-11-04 06:03', actor: '系統', actorRole: '系統', category: 'sync', target: 'GWS 訂閱', action: '每日同步完成：27 筆訂閱', result: 'success' },
  { at: '2026-11-04 02:15', actor: '系統', actorRole: '系統', category: 'sync', target: 'GCP 帳單匯出', action: '匯入 10/03 至 11/03 費用資料', result: 'success' },
];

export const auditLogs: AuditLog[] = [...fromWorkOrders, ...manual]
  .sort((a, b) => b.at.localeCompare(a.at))
  .map((l, i, arr) => ({ ...l, id: `L${String(arr.length - i).padStart(4, '0')}` }));
