# 零壹 SaaS 平台 Prototype

管理端 Prototype，全部使用假資料，不連任何後端或 Google API。需求來源見 [docs/handoff.md](docs/handoff.md)。

## 本機啟動

需要 Node.js 20 以上。

```bash
npm install
npm run dev
```

開啟終端機顯示的網址（預設 http://localhost:5173）。

## 資料夾

| 路徑 | 內容 |
| --- | --- |
| `src/shared/styles/tokens.css` | 設計變數（顏色、字級、間距、圓角），三個網站共用 |
| `src/shared/components/` | 共用元件：外框、表格、篩選列、狀態標籤、待確認標籤、提示訊息 |
| `src/shared/pendingItems.ts` | 待確認事項清單，對應 handoff「待確認事項」 |
| `src/data/` | 資料層。`api.ts` 是頁面唯一的取資料入口，`mock/` 是假資料 |
| `src/apps/admin/` | 管理端選單與頁面 |
