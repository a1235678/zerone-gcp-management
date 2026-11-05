/**
 * 資料層：頁面只透過這裡的函式取得或修改資料。
 * 目前回傳記憶體中的假資料；拿到 Terry 的 API 後，只需要把函式內容換成 fetch 呼叫。
 * 所有寫入只改記憶體，重新整理頁面就會回到初始資料。
 */
import { customers as seedCustomers } from './mock/customers';
import { dealers as seedDealers } from './mock/dealers';
import type { Customer, CustomerListItem, CustomerQuery, Dealer } from './types';

const db = {
  customers: structuredClone(seedCustomers),
  dealers: structuredClone(seedDealers),
};

/** 模擬網路延遲，讓載入狀態看得到 */
const delay = <T>(value: T, ms = 180) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

const dealerName = (id: string) => db.dealers.find((d) => d.id === id)?.name ?? '（未知經銷商）';

// ── 經銷商 ─────────────────────────────
export function getDealers(): Promise<Dealer[]> {
  return delay(db.dealers);
}

// ── 客戶 ───────────────────────────────
export function getCustomers(query: CustomerQuery = {}): Promise<CustomerListItem[]> {
  const kw = query.keyword?.trim().toLowerCase() ?? '';
  const rows = db.customers
    .filter((c) => !query.dealerId || c.dealerId === query.dealerId)
    .filter((c) => !query.status || c.status === query.status)
    .filter(
      (c) =>
        !kw ||
        c.name.toLowerCase().includes(kw) ||
        c.primaryDomain.includes(kw) ||
        c.taxId.includes(kw) ||
        c.contactName.toLowerCase().includes(kw),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => ({ ...c, dealerName: dealerName(c.dealerId) }));
  return delay(rows);
}

export function getCustomer(id: string): Promise<CustomerListItem | undefined> {
  const c = db.customers.find((x) => x.id === id);
  return delay(c ? { ...c, dealerName: dealerName(c.dealerId) } : undefined);
}

export type { Customer };
