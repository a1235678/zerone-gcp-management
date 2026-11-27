# 部署到 GCP VM（devtools.dev.terrylinla.com/admin/）

推到 `main` 後，GitHub Actions（`.github/workflows/deploy-vm.yml`）會自動建置，再用 SSH 把網站檔案傳到 VM。
GitHub Pages（假資料展示版）照常部署，兩個並存。

## 運作方式

1. GitHub Actions 執行 `npm ci`、`npm run build`，產生 `dist/`。
2. 用 rsync 把 `dist/` 傳到 VM 的 `/var/www/zerone-admin/releases/<時間>-<commit>/`。
3. 把 `/var/www/zerone-admin/current` 指到新版本（瞬間切換），只保留最近 5 個版本。
4. VM 上的 nginx 把 `/admin/` 對應到 `current`。其他路徑（例如後端的 Dev Tools）不受影響。

## 第一次設定（只要做一次）

### 1. 在 VM 上執行設定腳本

GCP 主控台 → Compute Engine → VM 執行個體 → 這台 VM 的「SSH」按鈕，開啟瀏覽器版終端機後執行：

```bash
git clone https://github.com/a1235678/zerone-gcp-management.git /tmp/zerone-admin-setup
```

```bash
sudo bash /tmp/zerone-admin-setup/deploy/vm-setup.sh
```

腳本會做這些事：

- 安裝 rsync。
- 建立部署專用帳號 `zerone-deploy`（沒有 sudo 權限）和網站目錄 `/var/www/zerone-admin`。
- 產生一把只給 GitHub Actions 用的 SSH 金鑰。
- 把 `deploy/nginx-admin.conf` 放到 `/etc/nginx/snippets/zerone-admin.conf`，並在 `devtools.dev.terrylinla.com` 的 nginx 設定加一行 `include`。
  - 改之前會先備份到 `/root/zerone-nginx-backup-<時間>/`。
  - 改完會先跑 `nginx -t` 檢查，失敗就自動還原。
- 最後印出 4 個要貼到 GitHub 的值。

腳本可以重複執行，但每次都會換一把新金鑰，GitHub 上的 `VM_SSH_KEY` 也要跟著更新。

### 2. 把 4 個值加到 GitHub

GitHub repo → Settings → Secrets and variables → Actions → **New repository secret**，把腳本印出的值逐一加進去：

| Secret | 內容 |
|---|---|
| `VM_HOST` | VM 的外部 IP（腳本抓不到時，到 GCP 主控台的 VM 列表看「外部 IP」） |
| `VM_USER` | `zerone-deploy` |
| `VM_KNOWN_HOSTS` | VM 的主機金鑰（整段） |
| `VM_SSH_KEY` | 私密金鑰（整段，包含 BEGIN 和 END 兩行） |

選填：同一頁的 **Variables** 分頁新增 `VM_API_BASE`，作為 VM 版本呼叫的 API 網址。沒設就用 `src/data/dataSource.ts` 裡的預設值。

### 3. 跑第一次部署

GitHub repo → Actions → **Deploy to VM** → Run workflow。之後每次推到 `main` 都會自動部署。
還沒設定 secret 時，這個 workflow 會顯示「略過部署」，不會失敗。

完成後打開 https://devtools.dev.terrylinla.com/admin/ 確認。

## 常見問題

- **Actions 卡在 SSH 連線（timeout）**：GCP 防火牆沒有開放 22 port 給外部。到 VPC 網路 → 防火牆，確認有允許 `tcp:22` 的規則（預設網路的 `default-allow-ssh` 就是）。
- **腳本說找不到 nginx 或找不到網域設定**：這個網域可能是用別的方式提供（Docker、Caddy、GCP 負載平衡器）。請把腳本的輸出給 Claude 看。
- **要退回上一版**：在 VM 上執行（把版本資料夾名稱換成要退回的那個）：

```bash
ls /var/www/zerone-admin/releases
```

```bash
sudo -u zerone-deploy ln -sfn releases/<版本資料夾> /var/www/zerone-admin/current
```

- **要停用自動部署**：刪掉 GitHub 上的 `VM_HOST` secret，workflow 就會略過部署。
