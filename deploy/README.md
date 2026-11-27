# 部署到 GCP VM（devtools.dev.terrylinla.com/admin/）

管理端前端掛在後端測試站的 `/admin/` 底下。推到 `main` 後自動更新，GitHub Pages（假資料展示版）照常部署，兩個並存。

## 運作方式

```
推到 main
  → GitHub Actions 建置，把網站打包上傳到 Release「admin-latest」（.github/workflows/deploy-vm.yml）
  → VM 每 2 分鐘檢查一次（systemd 計時器），有新版本就下載、驗證、切換（zerone-admin-update.sh）
  → 靜態檔容器 zerone-admin 提供 /var/www/zerone-admin/current
  → edge Caddy 把 devtools.<網域>/admin/* 轉給 zerone-admin，其他路徑照舊給 devtools
```

- **VM 只需要連出去**（HTTPS 下載），不用開 SSH 或任何連入的 port。GitHub 上也不用放 VM 的金鑰。
- 每個版本放在 `/var/www/zerone-admin/releases/<時間>-<commit>/`，`current` 指向目前版本，保留最近 5 版。
- 這台 VM 的網站由 Terry 的 cloud-ops 部署提供：Docker 裡的 edge Caddy（`cloud-ops-infra-edge-1`）處理 80／443，依網址把流量轉給加入 `cloud-ops-edge` 網路的容器。

| 檔案 | 用途 |
|---|---|
| `vm-setup.sh` | VM 一次性設定 |
| `zerone-admin-update.sh` | VM 定時檢查並下載新版本 |
| `compose.yml` | 靜態檔容器 zerone-admin |
| `Caddyfile.static` | 靜態檔容器的 Caddy 設定（快取標頭） |
| `edge-caddy-snippet.caddy` | 要加進 edge Caddyfile 的 `/admin/` 轉發，放在 `@devtools` 前面 |

## 第一次設定（只要做一次）

### 1. 連進 VM

GCP 主控台右上角開 **Cloud Shell**，執行（這台 VM 不對外開放 SSH，要走 IAP）：

```bash
gcloud compute ssh admin-portal-stage-backend --zone=asia-east1-b --tunnel-through-iap
```

看到 `...@admin-portal-stage-backend:~$` 才是進到 VM。瀏覽器版 SSH 的臨時金鑰幾分鐘就過期，過期時會斷線、sudo 也會失效，所以建議用 Cloud Shell。

### 2. 下載 repo 並執行設定腳本

```bash
rm -rf /tmp/zerone-admin-setup && git clone --depth 1 https://github.com/a1235678/zerone-gcp-management.git /tmp/zerone-admin-setup
```

```bash
sudo bash /tmp/zerone-admin-setup/deploy/vm-setup.sh
```

腳本會：

1. 找到 edge Caddy、它的 Docker 網路與 Caddyfile。
2. 建立部署帳號 `zerone-deploy`（沒有 sudo）和網站目錄。
3. 安裝更新程式與每 2 分鐘的計時器，並先下載一次最新版本（還沒發布過就先放一個「還沒有部署」的頁面）。
4. 啟動靜態檔容器 `zerone-admin`，加入 edge 的網路。
5. **在 edge 的 Caddyfile 加上 `/admin/` 的轉發**：
   - 先顯示要改的地方，**問你同意**（輸入 `y`）才改。
   - 改之前備份到 `/root/zerone-caddy-backup-<時間>/`，並先用 Caddy 驗證新設定。
   - 用重新載入（reload）套用，**不會斷線**；失敗會自動還原。
6. 最後檢查 `/admin/` 與根目錄的回應。

### 3. 跑第一次發布

GitHub repo → Actions → **Deploy to VM** → Run workflow（或推任何東西到 `main`）。跑完後 2 分鐘內 VM 會自動更新，打開 https://devtools.dev.terrylinla.com/admin/ 確認。

### 4. 請 Terry 把設定收進他的來源

edge 的 Caddyfile 是 Terry 的設定。請他把 `deploy/edge-caddy-snippet.caddy` 這段加進他自己的設定來源（放在 `@devtools` 前面），並在他的部署文件記一筆「有個 zerone-admin 容器加入 cloud-ops-edge 網路」。不然他下次部署時可能會把這段蓋掉，`/admin/` 就會不見（重跑 `vm-setup.sh` 可以再加回來）。

## 常用指令（在 VM 上）

看更新紀錄：

```bash
sudo journalctl -u zerone-admin-update --since today
```

馬上檢查一次新版本（不用等 2 分鐘）：

```bash
sudo systemctl start zerone-admin-update
```

看目前版本與保留的版本：

```bash
readlink /var/www/zerone-admin/current; ls /var/www/zerone-admin/releases
```

退回某一版（把 `<版本資料夾>` 換成上一行列出的名稱；下次發布新版本時會再自動更新）：

```bash
sudo -u zerone-deploy ln -sfn releases/<版本資料夾> /var/www/zerone-admin/current
```

暫停自動更新：

```bash
sudo systemctl disable --now zerone-admin-update.timer
```

## 常見問題

- **腳本說找不到 edge 容器或 `@devtools`**：Terry 的部署可能改過。請把腳本輸出給 Claude 看。
- **`/admin/` 出現 502**：edge 連不到 zerone-admin。查 `sudo docker ps` 有沒有 `zerone-admin-zerone-admin-1`，以及 `sudo docker logs zerone-admin-zerone-admin-1`。
- **一直是「還沒有部署」的頁面**：GitHub Actions 的 Deploy to VM 還沒跑成功，或 VM 連不到 github.com。看上面的更新紀錄。
- **API 網址**：GitHub repo → Settings → Secrets and variables → Actions → **Variables** 新增 `VM_API_BASE`。沒設就用 `src/data/dataSource.ts` 的預設值。前端和 API 都在 `devtools.dev.terrylinla.com` 底下時，就沒有 CORS 問題。
