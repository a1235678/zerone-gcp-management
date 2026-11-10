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
      {
        to: '/products/gcp',
        label: 'GCP',
        icon: 'cloud',
        children: [
          { to: '/products/gcp/usage', label: '流量與用量' },
          { to: '/products/gcp/billing', label: '帳單' },
        ],
      },
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
  '/products/gcp/usage': 'gcpUsage',
  '/products/gcp/billing': 'billing',
  '/schedules/gws': 'schedules',
  '/system/users': 'accounts',
  '/system/roles': 'roles',
  '/system/logs': 'auditLogs',
};

/** 這個網址需要的資源：取最長的前綴，例如 /products/gcp/billing/BILL-… 對到 billing */
export function resourceOf(pathname: string): ResourceKey | undefined {
  const key = Object.keys(pageResource)
    .filter((p) => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return key ? pageResource[key] : undefined;
}

/** 依權限過濾選單：子選單全部看不到時上層一起拿掉，整組都看不到的群組也拿掉 */
export function visibleNav(can: (r: ResourceKey) => boolean): NavGroup[] {
  const ok = (to: string) => !pageResource[to] || can(pageResource[to]);
  return adminNav
    .map((g) => ({
      ...g,
      items: g.items
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => ok(c.to)) } : i))
        .filter((i) => (i.children ? i.children.length > 0 : ok(i.to))),
    }))
    .filter((g) => g.items.length > 0);
}
