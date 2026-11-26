import type { GwsSku } from '../types';

// 後端從 Google 平台撈到的 Google Workspace 可訂閱方案（SKU 與 Offer）。
// 欄位依後端畫面（2026/11/24）：SKU、SKU ID、方案（年約／彈性／試用、供應至）、授權數範圍、計費週期、價格、Offer ID。
// ID 與價格皆為 Prototype 假資料。
const o = (
  offerId: string,
  planType: 'annual' | 'flexible' | 'trial',
  minSeats: number,
  maxSeats: number,
  billing: 'monthly' | 'yearly' | null,
  priceCents: number,
  availableUntil?: string,
) => ({ offerId, planType, minSeats, maxSeats, billing, priceCents, availableUntil });

export const gwsProductId = 'UADAVyrVqM6grP';

export const gwsSkus: GwsSku[] = [
  {
    skuId: 'SpB4sTr7kQ1aX9',
    name: 'Google Workspace Business Starter',
    version: 'Business Starter',
    offers: [
      o('SbsTr1aLm0nT9', 'trial', 1, 300, null, 0),
      o('SbsA1mOnth7Kq', 'annual', 1, 300, 'monthly', 700),
      o('SbsA1yEar3Pw2', 'annual', 1, 300, 'yearly', 8400),
      o('SbsF1exMnth5R', 'flexible', 1, 300, 'monthly', 840),
    ],
  },
  {
    skuId: 'SpB5sTd2mW4cZ7',
    name: 'Google Workspace Business Standard',
    version: 'Business Standard',
    offers: [
      o('SbdTr1aLx2nQ4', 'trial', 1, 300, null, 0),
      o('SbdA1mOnth8Lp', 'annual', 1, 300, 'monthly', 1400),
      o('SbdA1yEar6Mn1', 'annual', 1, 300, 'yearly', 16800),
      o('SbdA2mOnth9Vb', 'annual', 20, 300, 'monthly', 1400, '2027-01-01'),
      o('SbdF1exMnth3T', 'flexible', 1, 300, 'monthly', 1680),
    ],
  },
  {
    skuId: 'SEVlaChVhiSE2J',
    name: 'Google Workspace Business Plus',
    version: 'Business Plus',
    offers: [
      o('S02DAa97jzJ4', 'trial', 1, 300, null, 0),
      o('SCmIcp1PDnQK', 'annual', 20, 300, 'yearly', 26400, '2027-01-01'),
      o('SLP7bndN5tUd', 'annual', 20, 300, 'monthly', 2200, '2027-01-01'),
      o('SRAvb32455tG', 'annual', 1, 300, 'yearly', 26400),
      o('SSmEsIj0cjvB', 'annual', 1, 300, 'monthly', 2200),
      o('Si8KmhzqS0Hb', 'flexible', 1, 300, 'monthly', 2640),
    ],
  },
  {
    skuId: 'S6sH51ibL9dQY8',
    name: 'Google Workspace Enterprise Starter',
    version: 'Enterprise Starter',
    offers: [
      o('SHIfJfVXmYa5', 'annual', 1, 100000, 'monthly', 1100),
      o('Snw7F5ZZlYGd', 'flexible', 1, 100000, 'monthly', 1320),
      o('SzNNMoJKoBN2', 'annual', 1, 100000, 'yearly', 13200),
    ],
  },
  {
    skuId: 'SpE2sTd8hJ3kN6',
    name: 'Google Workspace Enterprise Standard',
    version: 'Enterprise Standard',
    offers: [
      o('SesA1mOnth2Hy', 'annual', 1, 100000, 'monthly', 2300),
      o('SesA1yEar4Ju8', 'annual', 1, 100000, 'yearly', 27600),
      o('SesF1exMnth6K', 'flexible', 1, 100000, 'monthly', 2760),
    ],
  },
  { skuId: 'S8hy74JT1ZkLiq', name: 'Google Workspace Frontline Standard', version: 'Frontline Standard', offers: [] },
  { skuId: 'SEStzAYQYpLwSc', name: 'Google Workspace Frontline Plus', version: 'Frontline Plus', offers: [] },
];
