import type { Dealer } from '../types';

// 名稱皆為虛構
export const dealers: Dealer[] = [
  { id: 'D000', name: '直銷（零壹）', isDirect: true, status: 'active', createdAt: '2024-01-02' },
  { id: 'D001', name: '北辰資訊', isDirect: false, status: 'active', createdAt: '2024-02-15' },
  { id: 'D002', name: '青嶼雲端', isDirect: false, status: 'active', createdAt: '2024-03-20' },
  { id: 'D003', name: '藍橋數位整合', isDirect: false, status: 'active', createdAt: '2024-05-06' },
  { id: 'D004', name: '森和系統', isDirect: false, status: 'suspended', createdAt: '2024-08-12' },
];
