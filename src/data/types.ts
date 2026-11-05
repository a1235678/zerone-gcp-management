// 資料型別：依 docs/handoff.md「資料與欄位」。拿到 Terry 的 API 格式後在這裡對照調整。

export type DealerStatus = 'active' | 'suspended';
export interface Dealer {
  id: string;
  name: string;
  /** 「直銷（零壹）」也當作一個經銷商 */
  isDirect: boolean;
  status: DealerStatus;
}

export type CustomerStatus = 'active' | 'disabled';
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
  /** ISO 日期 YYYY-MM-DD */
  createdAt: string;
  note: string;
  status: CustomerStatus;
}

export interface CustomerListItem extends Customer {
  dealerName: string;
}

export interface CustomerQuery {
  keyword?: string;
  dealerId?: string;
  status?: CustomerStatus | '';
}
