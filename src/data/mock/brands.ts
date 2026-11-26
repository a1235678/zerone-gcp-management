import type { Brand, Plan, Product } from '../types';

// 欄位待確認，先放最少的欄位
export const brands: Brand[] = [{ id: 'B01', name: 'Google', status: 'active', createdAt: '2024-01-02' }];

export const products: Product[] = [
  { id: 'P01', brandId: 'B01', name: 'Google Workspace', code: 'GWS', status: 'active', createdAt: '2024-01-02' },
  { id: 'P02', brandId: 'B01', name: 'Google Cloud', code: 'GCP', status: 'active', createdAt: '2024-01-02' },
];

// 方案（2026/11/10 會議加回來）。等級數字越大版本越高，用來判斷升版、降版。
// 版本依使用者提供的試算表（2026/11/26）：類別在前、版本在後。等級依表上的順序，數字越大越高（升降版判斷用，待確認）
export const plans: Plan[] = [
  { id: 'PL01', productId: 'P01', name: 'Business Starter', category: 'Google Workspace Starter', tier: 1, createdAt: '2024-01-02' },
  { id: 'PL02', productId: 'P01', name: 'Business Standard', category: 'Google Workspace Business', tier: 2, createdAt: '2024-01-02' },
  { id: 'PL03', productId: 'P01', name: 'Business Plus', category: 'Google Workspace Business', tier: 3, createdAt: '2024-01-02' },
  { id: 'PL05', productId: 'P01', name: 'Enterprise Essentials', category: 'Google Workspace Enterprise', tier: 4, createdAt: '2026-11-26' },
  { id: 'PL06', productId: 'P01', name: 'Enterprise Essentials Plus', category: 'Google Workspace Enterprise', tier: 5, createdAt: '2026-11-26' },
  { id: 'PL07', productId: 'P01', name: 'Enterprise Starter', category: 'Google Workspace Enterprise', tier: 6, createdAt: '2026-11-26' },
  { id: 'PL04', productId: 'P01', name: 'Enterprise Standard', category: 'Google Workspace Enterprise', tier: 7, createdAt: '2024-01-02' },
  { id: 'PL08', productId: 'P01', name: 'Enterprise Plus', category: 'Google Workspace Enterprise', tier: 8, createdAt: '2026-11-26' },
  { id: 'PL09', productId: 'P01', name: 'Frontline Starter', category: 'Google Workspace Frontline', tier: 9, createdAt: '2026-11-26' },
  { id: 'PL10', productId: 'P01', name: 'Frontline Standard', category: 'Google Workspace Frontline', tier: 10, createdAt: '2026-11-26' },
  { id: 'PL11', productId: 'P01', name: 'Frontline Plus', category: 'Google Workspace Frontline', tier: 11, createdAt: '2026-11-26' },
];
