import type { NavGroup } from '@shared/components/AppShell';
import type { ResourceKey } from '@data/types';

// 管理端選單：首頁、管理、產品、排程、系統（docs/handoff.md「管理端選單與頁面」）
export const adminNav: NavGroup[] = [
  { label: '首頁', items: [{ to: '/', label: '首頁', icon: 'home' }] },
  {
    label: '管理',
    items: [
      { to: '/customers', label: '客戶管理', icon: 'customers' },
      { to: '/dealers', label: '經銷商管理', icon: 'dealers' },
      { to: '/work-orders', label: '執行單', icon: 'workOrders' },
      { to: '/brands', label: '品牌管理', icon: 'brand' },
      { to: '/catalog', label: '產品管理', icon: 'product' },
    ],
  },
  {
    label: '產品',
    items: [
      { to: '/products/gws', label: 'GWS', icon: 'workspace' },
      { to: '/products/gcp', label: 'GCP', icon: 'cloud' },
    ],
  },
  { label: '排程', items: [{ to: '/schedules/gws', label: 'GWS 排程中心', icon: 'schedule' }] },
  {
    label: '系統',
    items: [
      { to: '/system/users', label: '使用者', icon: 'user' },
      { to: '/system/roles', label: '角色管理', icon: 'shield' },
      { to: '/system/logs', label: '系統日誌', icon: 'log' },
    ],
  },
];

/** 每一頁需要的權限資源（至少「唯讀」才看得到）。首頁所有人都看得到。 */
export const pageResource: Record<string, ResourceKey> = {
  '/customers': 'customers',
  '/dealers': 'dealers',
  '/work-orders': 'workOrders',
  '/brands': 'catalog',
  '/catalog': 'catalog',
  '/products/gws': 'subscriptions',
  '/products/gcp': 'gcpUsage',
  '/schedules/gws': 'schedules',
  '/system/users': 'accounts',
  '/system/roles': 'roles',
  '/system/logs': 'auditLogs',
};

/** 依權限過濾選單，整組都看不到的群組一起拿掉 */
export function visibleNav(can: (r: ResourceKey) => boolean): NavGroup[] {
  return adminNav
    .map((g) => ({ ...g, items: g.items.filter((i) => !pageResource[i.to] || can(pageResource[i.to])) }))
    .filter((g) => g.items.length > 0);
}
