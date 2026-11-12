import type { Dealer } from '../types';

// 名稱、代碼皆為虛構。經銷商代碼是客戶在 Google 申請轉移時要填的代碼（格式待確認）
export const dealers: Dealer[] = [
  { id: 'D000', code: 'ZR-DIRECT', name: '直銷（零壹）', isDirect: true, status: 'active', createdAt: '2024-01-02' },
  { id: 'D001', code: 'RS-1024', name: '北辰資訊', isDirect: false, status: 'active', createdAt: '2024-02-15' },
  { id: 'D002', code: 'RS-2048', name: '青嶼雲端', isDirect: false, status: 'active', createdAt: '2024-03-20' },
  { id: 'D003', code: 'RS-3072', name: '藍橋數位整合', isDirect: false, status: 'active', createdAt: '2024-05-06' },
  { id: 'D004', code: 'RS-4096', name: '森和系統', isDirect: false, status: 'suspended', createdAt: '2024-08-12' },
];
