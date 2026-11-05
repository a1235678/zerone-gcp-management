// 對應 docs/handoff.md「待確認事項」。答案出來後在這裡移除或更新，畫面上的「待確認」標籤會跟著變。
export const pendingItems = {
  1: { question: '客戶由誰建立？目前傳聞是 Connie', owner: 'Connie' },
  2: { question: '「帳單」是否獨立權限項目（經銷商要不要分 Billing 來看）', owner: 'Connie' },
  3: { question: 'API 能不能抓到 GWS 已購買的方案', owner: 'Terry' },
  4: { question: '客戶轉移是否確實使用 Cloud Channel API', owner: '技術（Ray）' },
  5: { question: 'PM 希望在這個系統看到哪些 GWS 資訊', owner: 'PM' },
  6: { question: '執行單是否放第一階段上線範圍', owner: 'Debbie／使用者' },
  7: { question: '排程任務、信件通知、TipTop 整合是否全部不做', owner: 'Debbie／使用者' },
  8: { question: '是否需要發票（Invoice）功能', owner: 'Connie' },
  9: { question: '後端語言、部署位置、API 格式', owner: 'Terry' },
} as const;

export type PendingId = keyof typeof pendingItems;
