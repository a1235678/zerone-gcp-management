import type { Dealer } from '../types';

// 名稱皆為虛構
export const dealers: Dealer[] = [
  { id: 'D000', name: '直銷（零壹）', isDirect: true, status: 'active' },
  { id: 'D001', name: '北辰資訊', isDirect: false, status: 'active' },
  { id: 'D002', name: '青嶼雲端', isDirect: false, status: 'active' },
  { id: 'D003', name: '藍橋數位整合', isDirect: false, status: 'active' },
  { id: 'D004', name: '森和系統', isDirect: false, status: 'suspended' },
];
