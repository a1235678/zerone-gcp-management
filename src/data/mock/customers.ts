import type { Customer } from '../types';

// 名稱、統編、聯絡人皆為虛構；網域一律 .example
const base: Customer[] = [
  c('C0001', '晨光設計工作室', '90010001', 'chenguang-design.example', 'D000', '陳品妤', '02-2700-1001', '林怡君', '2024-03-12'),
  c('C0002', '禾豐食品股份有限公司', '90010002', 'hefeng-foods.example', 'D001', '王建宏', '04-2300-1002', '林怡君', '2024-04-02'),
  c('C0003', '海岸線旅行社', '90010003', 'coastline-travel.example', 'D002', '張雅婷', '07-5500-1003', '黃柏翰', '2024-05-20'),
  c('C0004', '築光建築師事務所', '90010004', 'zhuguang-arch.example', 'D001', '李承恩', '02-2501-1004', '林怡君', '2024-06-08'),
  c('C0005', '橙果教育基金會', '90010005', 'orangefruit-edu.example', 'D003', '吳佳穎', '03-5600-1005', '黃柏翰', '2024-07-15'),
  c('C0006', '鷹揚物流', '90010006', 'yingyang-logistics.example', 'D002', '劉冠廷', '03-3300-1006', '黃柏翰', '2024-08-01'),
  c('C0007', '綠野生技', '90010007', 'greenfield-bio.example', 'D000', '蔡宜蓁', '02-2655-1007', '林怡君', '2024-08-22'),
  c('C0008', '星河遊戲', '90010008', 'galaxy-games.example', 'D003', '楊子豪', '02-8780-1008', '黃柏翰', '2024-09-10'),
  c('C0009', '福川精密工業', '90010009', 'fuchuan-precision.example', 'D001', '許志明', '04-2350-1009', '林怡君', '2024-10-03', 'disabled', '已停止合作，保留主檔供查詢'),
  c('C0010', '雲杉會計師事務所', '90010010', 'yunshan-cpa.example', 'D004', '鄭雅雯', '02-2391-1010', '黃柏翰', '2024-10-28'),
  c('C0011', '和光醫療器材', '90010011', 'heguang-medical.example', 'D002', '謝孟儒', '06-2800-1011', '黃柏翰', '2024-11-14'),
  c('C0012', '小麥烘焙坊', '90010012', 'wheat-bakery.example', 'D000', '洪詩涵', '02-2933-1012', '林怡君', '2024-12-05'),
  c('C0013', '遠岫顧問', '90010013', 'yuanxiu-consulting.example', 'D003', '郭俊傑', '02-2720-1013', '黃柏翰', '2025-01-09'),
  c('C0014', '藍鯨行銷', '90010014', 'bluewhale-marketing.example', 'D001', '曾婉婷', '02-2546-1014', '林怡君', '2025-02-17'),
  c('C0015', '松濤律師事務所', '90010015', 'songtao-law.example', 'D004', '邱彥廷', '02-2381-1015', '黃柏翰', '2025-03-03', 'disabled', '經銷商暫停，待轉移'),
  c('C0016', '恆毅自動化', '90010016', 'hengyi-automation.example', 'D002', '廖佩珊', '03-6660-1016', '黃柏翰', '2025-04-21'),
  c('C0017', '北極星語言中心', '90010017', 'polaris-language.example', 'D000', '賴韋辰', '02-2365-1017', '林怡君', '2025-05-30'),
  c('C0018', '豐禾農產', '90010018', 'fenghe-agri.example', 'D003', '周欣怡', '05-2700-1018', '黃柏翰', '2025-06-18'),
  c('C0019', '木與石家居', '90010019', 'wood-stone-home.example', 'D001', '徐家豪', '02-2764-1019', '林怡君', '2025-07-07'),
  c('C0020', '光點影像製作', '90010020', 'lightspot-studio.example', 'D002', '蘇郁庭', '02-2517-1020', '黃柏翰', '2025-08-25'),
  c('C0021', '安居物業管理', '90010021', 'anju-property.example', 'D000', '葉宗翰', '02-2914-1021', '林怡君', '2025-09-12'),
  c('C0022', '匯通貿易', '90010022', 'huitong-trading.example', 'D003', '呂思妤', '07-3300-1022', '黃柏翰', '2025-10-30'),
  c('C0023', '白鷺鷥文創', '90010023', 'egret-creative.example', 'D002', '江承翰', '06-2200-1023', '黃柏翰', '2026-10-28', 'active', '由其他經銷商轉入（WO-1027-002）'),
  c('C0024', '晴川電子', '90010024', 'qingchuan-elec.example', 'D001', '何佳蓉', '03-5770-1024', '林怡君', '2026-03-02'),
  c('C0025', '一葉茶堂', '90010025', 'oneleaf-tea.example', 'D000', '林冠宇', '049-2900-1025', '林怡君', '2026-06-19'),
  c('C0026', '新創合作社', '90010026', 'coop-lab.example', 'D003', '施怡安', '02-2706-1026', '黃柏翰', '2026-09-08', 'active', '新客戶，首張訂閱執行單簽核中', 'pending'),
  c('C0027', '曉風出版社', '90010027', 'xiaofeng-press.example', 'D003', '馮靜宜', '02-2368-1027', '黃柏翰', '2026-10-19', 'active', '轉入失敗，等客戶重新產生轉移碼'),
];

function c(
  id: string,
  name: string,
  taxId: string,
  primaryDomain: string,
  dealerId: string,
  contactName: string,
  contactPhone: string,
  createdBy: string,
  createdAt: string,
  status: Customer['status'] = 'active',
  note = '',
  domainVerification: Customer['domainVerification'] = 'verified',
): Customer {
  return {
    id,
    name,
    taxId,
    primaryDomain,
    dealerId,
    contactName,
    contactEmail: `admin@${primaryDomain}`,
    contactPhone,
    createdBy,
    createdAt,
    note,
    status,
    domainVerification,
    otherDomains: [],
    salesAssignments: [],
  };
}

// 其他網域（一個客戶可以有多個網域）
const otherDomains: Record<string, string[]> = {
  C0002: ['hefeng-bakery.example'],
  C0011: ['heguang-lab.example', 'heguang-care.example'],
  C0024: ['qingchuan-semi.example'],
};
// 有 GCP 的客戶
const gcpCustomers = new Set(['C0003', 'C0006', 'C0007', 'C0008', 'C0011', 'C0016', 'C0020', 'C0022', 'C0024']);
const SALES = ['黃柏翰', '李冠霖'];

/** 負責業務：新約沿用開發的業務；續約輪流分給兩位業務，示意同一客戶可以新約、續約不同人 */
export const customers: Customer[] = base.map((c, i) => {
  const newSales = SALES.includes(c.createdBy) ? c.createdBy : '李冠霖';
  const renewalSales = SALES[i % 2];
  const assignments: Customer['salesAssignments'] = [
    { product: 'GWS', term: 'new', salesName: newSales },
    { product: 'GWS', term: 'renewal', salesName: renewalSales },
  ];
  if (gcpCustomers.has(c.id)) {
    assignments.push({ product: 'GCP', term: 'new', salesName: '黃柏翰' }, { product: 'GCP', term: 'renewal', salesName: '黃柏翰' });
  }
  return { ...c, otherDomains: otherDomains[c.id] ?? [], salesAssignments: assignments };
});
