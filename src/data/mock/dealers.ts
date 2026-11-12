import type { Address, Dealer } from '../types';

// 名稱、統編、地址、聯絡人皆為虛構。經銷商主檔欄位是第一版，待 Connie 確認（#29）
const addr = (city: string, district: string, postalCode: string, street: string): Address => ({ country: '台灣', city, district, postalCode, street });

function d(
  id: string,
  name: string,
  shortName: string,
  taxId: string,
  status: Dealer['status'],
  createdAt: string,
  address: Address,
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  isDirect = false,
): Dealer {
  return {
    id,
    name,
    shortNames: shortName ? [shortName] : [],
    taxId,
    isDirect,
    status,
    registeredAddress: address,
    contactAddress: { ...address },
    contactSameAsRegistered: true,
    contactName,
    contactPhone,
    contactEmail,
    note: '',
    createdAt,
  };
}

export const dealers: Dealer[] = [
  d('D000', '直銷（零壹）', '', '', 'active', '2024-01-02', addr('台北市', '信義區', '110', '松仁路 100 號 20 樓'), '林怡君', '02-2720-0000', 'yijun.lin@zerone.example', true),
  d('D001', '北辰資訊股份有限公司', '北辰資訊', '80020001', 'active', '2024-02-15', addr('台北市', '內湖區', '114', '瑞光路 368 號 6 樓'), '周文彬', '02-2655-2001', 'admin@beichen-info.example'),
  d('D002', '青嶼雲端股份有限公司', '青嶼雲端', '80020002', 'active', '2024-03-20', addr('台中市', '西屯區', '407', '市政北二路 238 號 12 樓'), '潘俐君', '04-2251-2002', 'admin@qingyu-cloud.example'),
  d('D003', '藍橋數位整合有限公司', '藍橋數位整合', '80020003', 'active', '2024-05-06', addr('高雄市', '前鎮區', '806', '成功二路 25 號 9 樓'), '方靜怡', '07-3360-2003', 'admin@lanqiao-digital.example'),
  d('D004', '森和系統有限公司', '森和系統', '80020004', 'suspended', '2024-08-12', addr('新竹市', '東區', '300', '光復路二段 101 號'), '江志遠', '03-5710-2004', 'admin@senhe-sys.example'),
];
