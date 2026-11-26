import type { Brand, Plan, Product } from '../types';

// 欄位待確認，先放最少的欄位
export const brands: Brand[] = [{ id: 'B01', name: 'Google', status: 'active', createdAt: '2024-01-02' }];

export const products: Product[] = [
  { id: 'P01', brandId: 'B01', name: 'Google Workspace', code: 'GWS', status: 'active', createdAt: '2024-01-02' },
  { id: 'P02', brandId: 'B01', name: 'Google Cloud', code: 'GCP', status: 'active', createdAt: '2024-01-02' },
];

// 方案（2026/11/10 會議加回來）。等級數字越大版本越高，用來判斷升版、降版。
export const plans: Plan[] = [
  { id: 'PL01', productId: 'P01', name: 'Business Starter', category: 'Business', tier: 1, createdAt: '2024-01-02' },
  { id: 'PL02', productId: 'P01', name: 'Business Standard', category: 'Business', tier: 2, createdAt: '2024-01-02' },
  { id: 'PL03', productId: 'P01', name: 'Business Plus', category: 'Business', tier: 3, createdAt: '2024-01-02' },
  { id: 'PL04', productId: 'P01', name: 'Enterprise Standard', category: 'Enterprise', tier: 4, createdAt: '2024-01-02' },
];
