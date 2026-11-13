// 對應 docs/handoff.md「待確認事項」。答案出來後在這裡移除或更新，畫面上的「待確認」標籤會跟著變。
// 已確認並移除：#18 到期通知固定 30、3 天（2026/11/12）；#2 帳單是獨立權限項目、#8 不做發票功能（2026/11/10）；#19 不提供取消訂閱（2026/11/11）；#4 客戶轉入使用 Cloud Channel API、#6 執行單放第二階段（2026/11/13）。
export const pendingItems = {
  1: { question: '客戶由誰建立？目前傳聞是 Connie', owner: 'Connie' },
  3: { question: 'API 能不能抓到 GWS 已購買的方案', owner: 'Terry' },
  5: { question: 'PM 希望在這個系統看到哪些 GWS 資訊', owner: 'PM' },
  7: { question: '排程任務、TipTop 整合是否不做；信件通知要做，是否放第一階段', owner: 'Debbie／使用者' },
  9: { question: '後端語言、部署位置、API 格式', owner: 'Terry' },
  10: { question: 'GCP 帳單加成規則（目前假設直銷 15%、經銷商客戶 10%）', owner: '待指定' },
  11: { question: '匯率來源與取價日（目前每月固定一個匯率）', owner: '待指定' },
  12: { question: '付款期限（目前假設出帳後 30 天）', owner: '待指定' },
  13: { question: 'Google 帳單取得方式（手動上傳或 API）', owner: 'Terry' },
  14: { question: '對帳差異容許範圍（目前差 0.01 USD 也算差異）', owner: '待指定' },
  15: { question: '能否取得客戶的經銷商名稱', owner: 'Terry' },
  16: { question: '合約未到期前的中途升版，能否做自動排程', owner: 'Terry' },
  17: { question: '續約降版能否排程執行（目前先人工執行）', owner: 'Terry' },
  20: { question: '「客戶都要掛在羽昇底下」是否也適用 GWS；直銷要不要調整', owner: '後勤' },
  21: { question: '能否取得系統設定的用量上限數字', owner: 'Ray' },
  22: { question: 'Gemini Enterprise 能否取得用量和 token 數', owner: 'Ray' },
  23: { question: '建立使用者帳號時，是否會連動到 GCP', owner: 'Ray' },
  25: { question: '會不會有個人客戶', owner: 'Connie' },
  26: { question: '「一般聯絡人」頁籤要不要拿掉', owner: 'Connie' },
  27: { question: '快到期但已設定續約排程的客戶，還要不要寄到期通知', owner: 'Connie' },
  28: { question: '轉入的客戶資料由誰來填寫', owner: 'Connie' },
  29: { question: '經銷商主檔要有哪些欄位', owner: 'Connie' },
  30: { question: '到期前 1 天要不要再寄一次通知', owner: '待指定' },
} as const;

export type PendingId = keyof typeof pendingItems;
