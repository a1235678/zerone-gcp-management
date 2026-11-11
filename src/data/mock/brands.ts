import type { Brand, Plan, Product } from '../types';

// 欄位待確認，先放最少的欄位
export const brands: Brand[] = [{ id: 'B01', name: 'Google', status: 'active', createdAt: '2024-01-02' }];

export const products: Product[] = [
  { id: 'P01', brandId: 'B01', name: 'Google Workspace', code: 'GWS', status: 'active', createdAt: '2024-01-02' },
  { id: 'P02', brandId: 'B01', name: 'Google Cloud', code: 'GCP', status: 'active', createdAt: '2024-01-02' },
];

// 方案（2026/11/10 會議加回來）。等級數字越大版本越高，用來判斷升版、降版。
export const plans: Plan[] = [
  { id: 'PL01', productId: 'P01', name: 'Business Starter', tier: 1, status: 'active', createdAt: '2024-01-02' },
  { id: 'PL02', productId: 'P01', name: 'Business Standard', tier: 2, status: 'active', createdAt: '2024-01-02' },
  { id: 'PL03', productId: 'P01', name: 'Business Plus', tier: 3, status: 'active', createdAt: '2024-01-02' },
  { id: 'PL04', productId: 'P01', name: 'Enterprise Standard', tier: 4, status: 'active', createdAt: '2024-01-02' },
  { id: 'PL05', productId: 'P01', name: 'Enterprise Plus', tier: 5, status: 'draft', createdAt: '2026-11-10' },
];
