import type { BillLine, BillStatus, GcpBill, GoogleInvoice } from "../types";
import { mulberry32 } from "./gcp";

// GCP 帳單假資料：2026 年 9 月與 10 月，每月 9 個 GCP 客戶。
// 每張帳單的 Google 費用 = 費用明細加總（美分），應收 TWD = 費用 ×（1＋加成）× 匯率，四捨五入到元。
// 加成先假設「直銷 15%、經銷商客戶 10%」，匯率先假設固定值，都是待確認事項。
// 這份資料以 Prototype 的「今天」2026/11/05 為準：9 月帳單 10/03 出帳、11/02 到期；10 月帳單 11/03 起陸續出帳。

export const BILL_MONTHS = [
  { month: "2026-10", label: "2026 年 10 月", rate: 32.1 },
  { month: "2026-09", label: "2026 年 9 月", rate: 32.25 },
];
export const PAYMENT_DAYS = 30;

const SYSTEM = "系統";
const OPS = "何佩真";

interface Seed {
  customerId: string;
  /** 專案代號前綴 */
  prefix: string;
  projects: string[];
  markupPct: number;
  octCents: number;
  sepFactor: number;
}

const seeds: Seed[] = [
  {
    customerId: "C0011",
    prefix: "heguang",
    projects: [
      "his",
      "pacs",
      "erp",
      "web",
      "api",
      "data",
      "backup",
      "analytics",
      "iot",
      "crm",
      "staging",
      "ml",
    ],
    markupPct: 10,
    octCents: 528640,
    sepFactor: 0.94,
  },
  {
    customerId: "C0024",
    prefix: "qingchuan",
    projects: [
      "mes",
      "erp",
      "web",
      "api",
      "data",
      "iot",
      "backup",
      "staging",
      "analytics",
    ],
    markupPct: 10,
    octCents: 410275,
    sepFactor: 0.89,
  },
  {
    customerId: "C0008",
    prefix: "galaxy",
    projects: [
      "game-prod",
      "game-test",
      "match",
      "web",
      "data",
      "cdn",
      "analytics",
    ],
    markupPct: 10,
    octCents: 331820,
    sepFactor: 0.84,
  },
  {
    customerId: "C0006",
    prefix: "yingyang",
    projects: ["tms", "wms", "web", "api", "data"],
    markupPct: 10,
    octCents: 184610,
    sepFactor: 1.03,
  },
  {
    customerId: "C0016",
    prefix: "hengyi",
    projects: ["scada", "web", "data", "backup"],
    markupPct: 10,
    octCents: 119055,
    sepFactor: 0.97,
  },
  {
    customerId: "C0020",
    prefix: "lightspot",
    projects: ["render", "web", "assets"],
    markupPct: 10,
    octCents: 112280,
    sepFactor: 0.99,
  },
  {
    customerId: "C0007",
    prefix: "greenfield",
    projects: ["lims", "web", "data"],
    markupPct: 15,
    octCents: 59835,
    sepFactor: 1.0,
  },
  {
    customerId: "C0003",
    prefix: "coastline",
    projects: ["booking", "web"],
    markupPct: 10,
    octCents: 53190,
    sepFactor: 0.77,
  },
  {
    customerId: "C0022",
    prefix: "huitong",
    projects: ["erp"],
    markupPct: 10,
    octCents: 17825,
    sepFactor: 1.02,
  },
];

const services = [
  "Compute Engine",
  "Cloud SQL",
  "Cloud Storage",
  "BigQuery",
  "網路輸出",
  "Cloud Run",
  "Kubernetes Engine",
];

/** 把總額拆成「專案 × 服務」明細，最後一筆補差額，保證加總等於總額 */
function splitLines(seed: Seed, total: number, salt: number): BillLine[] {
  // 光點影像製作的 10 月明細和畫面示意一致
  if (seed.customerId === "C0020" && salt === 10) {
    return [
      {
        service: "Compute Engine",
        project: "lightspot-render",
        costCents: 61240,
      },
      { service: "Cloud SQL", project: "lightspot-web", costCents: 20150 },
      {
        service: "Cloud Storage",
        project: "lightspot-assets",
        costCents: 14830,
      },
      { service: "BigQuery", project: "lightspot-web", costCents: 9210 },
      { service: "網路輸出", project: "lightspot-assets", costCents: 6850 },
    ];
  }
  const rand = mulberry32(Number(seed.customerId.slice(1)) * 100 + salt);
  const parts: { service: string; project: string; w: number }[] = [];
  seed.projects.forEach((p, i) => {
    const n = 1 + Math.floor(rand() * 3);
    const start = Math.floor(rand() * services.length);
    const projectWeight = 1 / (i + 1.4);
    for (let k = 0; k < n; k++)
      parts.push({
        service: services[(start + k) % services.length],
        project: `${seed.prefix}-${p}`,
        w: projectWeight * (0.4 + rand()),
      });
  });
  const sumW = parts.reduce((s, x) => s + x.w, 0);
  const lines = parts.map((x) => ({
    service: x.service,
    project: x.project,
    costCents: Math.floor((total * x.w) / sumW),
  }));
  const rest = total - lines.reduce((s, l) => s + l.costCents, 0);
  lines[0].costCents += rest;
  return lines.sort((a, b) => b.costCents - a.costCents);
}

const ev = (at: string, actor: string, text: string) => ({ at, actor, text });

// 10 月：已出帳、已收款、待確認（星河遊戲、匯通貿易對帳有差異，光點影像製作等後勤確認）
const octState: Record<string, { status: BillStatus; paidAt?: string }> = {
  C0011: { status: "paid", paidAt: "2026-11-04" },
  C0024: { status: "billed" },
  C0008: { status: "pending" },
  C0006: { status: "paid", paidAt: "2026-11-05" },
  C0016: { status: "billed" },
  C0020: { status: "pending" },
  C0007: { status: "paid", paidAt: "2026-11-04" },
  C0003: { status: "billed" },
  C0022: { status: "pending" },
};
// 9 月：都已出帳，星河遊戲尚未付款（11/02 到期，已逾期）
const sepUnpaid = new Set(["C0008"]);

function makeBill(
  seed: Seed,
  month: "2026-09" | "2026-10",
  no: number,
): GcpBill {
  const isOct = month === "2026-10";
  const total = isOct
    ? seed.octCents
    : Math.round(seed.octCents * seed.sepFactor);
  const rate = BILL_MONTHS.find((m) => m.month === month)!.rate;
  const id = `BILL-${month.slice(2, 4)}${month.slice(5, 7)}-${String(no).padStart(3, "0")}`;
  const calcDay = isOct ? "2026-11-02" : "2026-10-02";
  const history = [
    ev(
      `${calcDay} 02:15`,
      SYSTEM,
      `匯入 ${Number(month.slice(5))} 月 GCP 費用`,
    ),
    ev(`${calcDay} 06:10`, SYSTEM, "系統計算完成，等待後勤確認"),
  ];
  const bill: GcpBill = {
    id,
    month,
    customerId: seed.customerId,
    projects: seed.projects.length,
    lines: splitLines(seed, total, isOct ? 10 : 9),
    adjustmentCents: 0,
    markupPct: seed.markupPct,
    rate,
    status: "pending",
    history,
  };
  const st = isOct
    ? octState[seed.customerId]
    : {
        status: (sepUnpaid.has(seed.customerId)
          ? "billed"
          : "paid") as BillStatus,
        paidAt:
          seed.customerId === "C0003"
            ? "2026-11-01"
            : "2026-10-" + String(10 + (no % 15)).padStart(2, "0"),
      };
  if (st.status !== "pending") {
    bill.status = st.status;
    bill.issuedAt = isOct ? "2026-11-03" : "2026-10-03";
    bill.dueDate = isOct ? "2026-12-03" : "2026-11-02";
    history.push(
      ev(`${bill.issuedAt} 14:20`, OPS, "確認並出帳，帳單已寄給帳務聯絡人"),
    );
    if (st.status === "paid") {
      bill.paidAt = st.paidAt;
      history.push(ev(`${st.paidAt} 16:05`, OPS, "標記已收款"));
    }
  }
  bill.history = history.reverse();
  return bill;
}

export const gcpBills: GcpBill[] = [
  ...seeds.map((s, i) => makeBill(s, "2026-10", i + 1)),
  ...seeds.map((s, i) => makeBill(s, "2026-09", i + 1)),
];

const totalOf = (b: GcpBill) => b.lines.reduce((s, l) => s + l.costCents, 0);
const amounts = (month: string, diff: Record<string, number> = {}) =>
  Object.fromEntries(
    gcpBills
      .filter((b) => b.month === month)
      .map((b) => [b.customerId, totalOf(b) + (diff[b.customerId] ?? 0)]),
  );

// Google 寄來的帳單（後勤上傳）。10 月有兩筆和我方計算不同，尚未處理。
export const googleInvoices: GoogleInvoice[] = [
  {
    month: "2026-10",
    fileName: "google-invoice-2026-10.pdf",
    uploadedAt: "2026-11-03 09:20",
    uploadedBy: OPS,
    amounts: amounts("2026-10", { C0008: -1240, C0022: 35 }),
    resolutions: {},
  },
  {
    month: "2026-09",
    fileName: "google-invoice-2026-09.pdf",
    uploadedAt: "2026-10-03 09:05",
    uploadedBy: OPS,
    amounts: amounts("2026-09"),
    resolutions: {},
  },
];
