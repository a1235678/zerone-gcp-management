import type { Brand, Product } from '../types';

// 欄位待確認，先放最少的欄位
export const brands: Brand[] = [{ id: 'B01', name: 'Google', status: 'active', createdAt: '2024-01-02' }];

export const products: Product[] = [
  { id: 'P01', brandId: 'B01', name: 'Google Workspace', code: 'GWS', status: 'active', createdAt: '2024-01-02' },
  { id: 'P02', brandId: 'B01', name: 'Google Cloud', code: 'GCP', status: 'active', createdAt: '2024-01-02' },
];
