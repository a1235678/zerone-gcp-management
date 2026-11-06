# 零壹 SaaS 平台 Prototype

管理端 Prototype，全部使用假資料，不連任何後端或 Google API。需求來源見 [docs/handoff.md](docs/handoff.md)。

## 本機啟動

需要 Node.js 20 以上。

```bash
npm install
npm run dev
```

開啟終端機顯示的網址（預設 http://localhost:5173）。

其他指令：

- `npm run build`：型別檢查並建置到 `dist/`
- `npm run preview`：在本機預覽建置結果

所有「送出」類動作只改記憶體中的資料，重新整理頁面就會回到初始假資料。

## 部署成可分享的連結（GitHub Pages）

repo 裡已經有 `.github/workflows/deploy.yml`，推到 `main` 就會自動建置並部署。

1. 把 `claude/admin-prototype` 合併進 `main`。
2. 到 GitHub repo 的 **Settings → Pages → Build and deployment**，把 **Source** 設為 **GitHub Actions**（只需要設定一次）。
3. 到 **Actions** 分頁確認「Deploy to GitHub Pages」執行成功。
4. 網址會是 `https://<帳號>.github.io/zerone-gcp-management/`。

注意：免費方案的 GitHub Pages 是公開網站，任何拿到網址的人都看得到。內容雖然都是假資料，如果不想公開，可以改用 Cloudflare Pages 加上 Cloudflare Access 限制登入：建置指令 `npm run build`，輸出資料夾 `dist`。

網站使用相對路徑與 `#/` 網址，部署在任何子路徑或靜態主機都可以直接開啟各頁。

## 資料夾

| 路徑 | 內容 |
| --- | --- |
| `src/shared/styles/tokens.css` | 設計變數（顏色、字級、間距、圓角），三個網站共用 |
| `src/shared/styles/components.css` | 共用元件樣式 |
| `src/shared/components/` | 共用元件：外框、表格、篩選列、狀態標籤、待確認標籤、對話框、表單、圖表、提示訊息 |
| `src/shared/pendingItems.ts` | 待確認事項清單，對應 handoff「待確認事項」。答案出來後在這裡移除，畫面上的標籤會跟著變 |
| `src/data/api.ts` | 資料層：頁面唯一的取資料入口。換成真 API 時只改這個檔案 |
| `src/data/types.ts` | 資料型別，拿到 Terry 的 API 格式後在這裡對照欄位 |
| `src/data/labels.ts` | 各種代碼的中文名稱 |
| `src/data/mock/` | 假資料（網域一律 `.example`，名稱皆為虛構） |
| `src/apps/admin/` | 管理端：選單、頁面、管理端專用元件 |

經銷商端與客戶端之後在 `src/apps/` 底下各開一個資料夾，重用 `src/shared` 與 `src/data`。

## 假資料的一致性

- 經銷商的「總席次」由名下客戶的 GWS 訂閱加總，和 GWS 頁的總席次相同。
- GCP 每日費用、各客戶小計、總計都由同一份「每客戶每日費用」加總。
- 送 Google 的操作完成時會把結果寫回訂閱（例如調整席次後，GWS 頁的席次會變）。
- 執行單完成所有處理步驟時會自動變成「完成」。
- 執行單的每一步、每次送 Google、新增客戶、帳號與角色變更都會寫入系統日誌。
- 「今天」固定為 2026/11/05，到期天數以此計算。
