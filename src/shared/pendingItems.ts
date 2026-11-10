// 對應 docs/handoff.md「待確認事項」。答案出來後在這裡移除或更新，畫面上的「待確認」標籤會跟著變。
// 已確認並移除：#2 帳單是獨立權限項目、#8 不做發票功能（2026/11/10）。
export const pendingItems = {
  1: { question: '客戶由誰建立？目前傳聞是 Connie', owner: 'Connie' },
  3: { question: 'API 能不能抓到 GWS 已購買的方案', owner: 'Terry' },
  4: { question: '客戶轉移是否確實使用 Cloud Channel API', owner: '技術（Ray）' },
  5: { question: 'PM 希望在這個系統看到哪些 GWS 資訊', owner: 'PM' },
  6: { question: '執行單是否放第一階段上線範圍', owner: 'Debbie／使用者' },
  7: { question: '排程任務、信件通知、TipTop 整合是否全部不做', owner: 'Debbie／使用者' },
  9: { question: '後端語言、部署位置、API 格式', owner: 'Terry' },
  10: { question: 'GCP 帳單加成規則（目前假設直銷 15%、經銷商客戶 10%）', owner: '待指定' },
  11: { question: '匯率來源與取價日（目前每月固定一個匯率）', owner: '待指定' },
  12: { question: '付款期限（目前假設出帳後 30 天）', owner: '待指定' },
  13: { question: 'Google 帳單取得方式（手動上傳或 API）', owner: 'Terry' },
  14: { question: '對帳差異容許範圍（目前差 0.01 USD 也算差異）', owner: '待指定' },
} as const;

export type PendingId = keyof typeof pendingItems;
