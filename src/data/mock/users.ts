import type { User } from '../types';
import { customers } from './customers';

// 姓名皆為虛構。內部帳號 email 用 zerone.example
const internal: User[] = [
  u('U001', '林怡君', 'yijun.lin@zerone.example', 'internal', 'ZERONE', 'R01', 'active', false, '2026-11-05 08:52', '2024-01-02'),
  u('U002', '黃柏翰', 'pohan.huang@zerone.example', 'internal', 'ZERONE', 'R03', 'active', false, '2026-11-05 09:05', '2024-01-02'),
  u('U003', '陳思穎', 'szuying.chen@zerone.example', 'internal', 'ZERONE', 'R02', 'active', false, '2026-11-04 17:40', '2024-02-01'),
  u('U004', '張家銘', 'chiaming.chang@zerone.example', 'internal', 'ZERONE', 'R05', 'active', false, '2026-11-05 09:30', '2024-03-11'),
  u('U005', '王雅琪', 'yachi.wang@zerone.example', 'internal', 'ZERONE', 'R04', 'active', false, '2026-11-03 14:12', '2024-06-17'),
  u('U006', '李冠霖', 'kuanlin.li@zerone.example', 'internal', 'ZERONE', 'R06', 'active', false, '2026-11-02 10:08', '2025-01-06'),
  u('U008', '蔡明峰', 'mingfeng.tsai@zerone.example', 'internal', 'ZERONE', 'R12', 'active', false, '2026-11-05 08:40', '2024-01-15'),
  u('U009', '鄭志豪', 'chihhao.cheng@zerone.example', 'internal', 'ZERONE', 'R13', 'active', false, '2026-11-05 08:58', '2024-01-15'),
  u('U010', '何佩真', 'peichen.ho@zerone.example', 'internal', 'ZERONE', 'R14', 'active', false, '2026-11-05 09:10', '2024-04-08'),
  u('U007', '吳承澤', 'chengtse.wu@zerone.example', 'internal', 'ZERONE', 'R07', 'disabled', false, '2026-08-29 18:20', '2025-04-01'),
];

const dealerUsers: User[] = [
  u('U101', '周文彬', 'admin@beichen-it.example', 'dealer', 'D001', 'R08', 'active', true, '2026-11-05 08:30', '2024-02-15'),
  u('U102', '鍾慧如', 'finance@beichen-it.example', 'dealer', 'D001', 'R10', 'active', false, '2026-11-01 11:00', '2024-09-02'),
  u('U103', '高偉倫', 'sales@beichen-it.example', 'dealer', 'D001', 'R08', 'active', false, '2026-10-30 16:45', '2025-03-18'),
  u('U104', '潘俐君', 'admin@qingyu-cloud.example', 'dealer', 'D002', 'R08', 'active', true, '2026-11-04 13:22', '2024-03-20'),
  u('U105', '梁志遠', 'ops@qingyu-cloud.example', 'dealer', 'D002', 'R08', 'active', false, '2026-11-05 07:58', '2025-07-01'),
  u('U106', '方靜怡', 'admin@lanqiao-digital.example', 'dealer', 'D003', 'R08', 'active', true, '2026-11-04 10:10', '2024-05-06'),
  u('U107', '石凱文', 'pm@lanqiao-digital.example', 'dealer', 'D003', 'R08', 'invited', false, null, '2026-11-03'),
  u('U108', '杜明哲', 'admin@senhe-sys.example', 'dealer', 'D004', 'R08', 'disabled', true, '2026-09-12 09:00', '2024-08-12'),
];

// 每個客戶的第一個組織管理員 = 客戶主檔的聯絡人
const customerAdmins: User[] = customers.map((c, i) => {
  const status: User['status'] = c.status === 'disabled' ? 'disabled' : c.domainVerification === 'pending' ? 'invited' : 'active';
  return u(
    `U2${String(i + 1).padStart(2, '0')}`,
    c.contactName,
    c.contactEmail,
    'customer',
    c.id,
    'R09',
    status,
    true,
    status === 'active' ? `2026-11-0${(i % 5) + 1} ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}` : null,
    c.createdAt,
  );
});

const customerExtra: User[] = [
  u('U301', '馬欣妤', 'it@hefeng-foods.example', 'customer', 'C0002', 'R11', 'active', false, '2026-11-04 15:20', '2024-05-10'),
  u('U302', '彭家豪', 'it2@hefeng-foods.example', 'customer', 'C0002', 'R11', 'active', false, '2026-10-29 09:41', '2025-02-03'),
  u('U303', '溫子涵', 'mis@heguang-medical.example', 'customer', 'C0011', 'R09', 'active', false, '2026-11-05 08:05', '2025-01-20'),
];

export const users: User[] = [...internal, ...dealerUsers, ...customerAdmins, ...customerExtra];

function u(
  id: string,
  name: string,
  email: string,
  orgType: User['orgType'],
  orgId: string,
  roleId: string,
  status: User['status'],
  isFirstAdmin: boolean,
  lastLoginAt: string | null,
  createdAt: string,
): User {
  return { id, name, email, orgType, orgId, roleId, status, isFirstAdmin, lastLoginAt, createdAt };
}
