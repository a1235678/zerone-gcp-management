#!/usr/bin/env bash
# VM 一次性設定：讓管理端掛在 https://devtools.<BASE_DOMAIN>/admin/，並自動更新。
#
# 這台 VM 的網站由 Docker 裡的 edge Caddy 提供（Terry 的 cloud-ops 部署）。這個腳本會：
#   1. 建立帳號 zerone-deploy（沒有 sudo）與網站目錄 /var/www/zerone-admin
#   2. 安裝更新程式與 systemd 計時器：每 2 分鐘到 GitHub Release 檢查新版本，有就下載切換
#   3. 啟動靜態檔容器 zerone-admin，加入 edge 的 Docker 網路
#   4. 在 edge 的 Caddyfile 加上 /admin/ 的轉發（會先顯示差異、問你同意；先備份、先驗證，失敗自動還原）
#
# 用法（在 VM 上）：sudo bash deploy/vm-setup.sh
# 可以重複執行，已經做過的步驟會略過。
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_USER="${DEPLOY_USER:-zerone-deploy}"
WEB_ROOT="${WEB_ROOT:-/var/www/zerone-admin}"
OPT=/opt/zerone-admin
ASSUME_YES="${ASSUME_YES:-no}"
[ "${1:-}" = "--yes" ] && ASSUME_YES=yes

[ "$(id -u)" -eq 0 ] || { echo "請用 sudo 執行：sudo bash $0"; exit 1; }
for f in Caddyfile.static compose.yml edge-caddy-snippet.caddy zerone-admin-update.sh; do
  [ -f "$HERE/$f" ] || { echo "找不到 $HERE/$f，請在 repo 的 deploy 資料夾裡執行"; exit 1; }
done
command -v docker >/dev/null || { echo "這台 VM 沒有 Docker"; exit 1; }

echo "== 0. 找 edge Caddy =="
EDGE="${EDGE:-$(docker ps --format '{{.Names}}' | grep -E 'infra-edge' | head -1)}"
[ -n "$EDGE" ] || { echo "!! 找不到 edge 容器（名稱含 infra-edge）。請把 sudo docker ps 的結果給 Claude 看。"; exit 1; }
EDGE_NETWORK="${EDGE_NETWORK:-$(docker inspect "$EDGE" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | grep -E 'edge' | head -1)}"
[ -n "$EDGE_NETWORK" ] || { echo "!! 找不到 edge 的 Docker 網路"; exit 1; }
CADDYFILE="$(docker inspect "$EDGE" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')"
[ -f "$CADDYFILE" ] || { echo "!! 找不到 edge 的 Caddyfile"; exit 1; }
BASE_DOMAIN="$(docker exec "$EDGE" printenv BASE_DOMAIN 2>/dev/null || true)"
echo "edge 容器：$EDGE"
echo "edge 網路：$EDGE_NETWORK"
echo "Caddyfile：$CADDYFILE"
echo "網域：devtools.${BASE_DOMAIN:-（讀不到 BASE_DOMAIN）}"

echo "== 1. 部署帳號與網站目錄 =="
command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl; }
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
# 舊做法（GitHub Actions 用 SSH 連進來）留下的金鑰不再需要，拿掉
if [ -f "/home/$DEPLOY_USER/.ssh/authorized_keys" ]; then
  sed -i '/github-actions-zerone-admin/d' "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
mkdir -p "$WEB_ROOT/releases"
if [ ! -e "$WEB_ROOT/current" ]; then
  mkdir -p "$WEB_ROOT/releases/placeholder"
  echo '<!doctype html><meta charset="utf-8"><title>零壹雲管家</title><p>還沒有部署，請等幾分鐘。</p>' > "$WEB_ROOT/releases/placeholder/index.html"
  ln -sfn releases/placeholder "$WEB_ROOT/current"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$WEB_ROOT"
chmod 755 "$WEB_ROOT" "$WEB_ROOT/releases"

echo "== 2. 更新程式與每 2 分鐘的計時器 =="
mkdir -p "$OPT"
install -m 755 "$HERE/zerone-admin-update.sh" "$OPT/update.sh"
install -m 644 "$HERE/Caddyfile.static" "$OPT/Caddyfile"
install -m 644 "$HERE/compose.yml" "$OPT/compose.yml"
cat > /etc/systemd/system/zerone-admin-update.service <<UNIT
[Unit]
Description=零壹雲管家管理端：檢查並下載新版本
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=$DEPLOY_USER
Environment=ROOT=$WEB_ROOT
ExecStart=$OPT/update.sh
UNIT
cat > /etc/systemd/system/zerone-admin-update.timer <<'UNIT'
[Unit]
Description=零壹雲管家管理端：每 2 分鐘檢查新版本

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now zerone-admin-update.timer >/dev/null
runuser -u "$DEPLOY_USER" -- env ROOT="$WEB_ROOT" "$OPT/update.sh" || echo "（第一次下載沒成功，計時器之後會再試）"
echo "目前版本：$(readlink "$WEB_ROOT/current")"

echo "== 3. 啟動靜態檔容器 zerone-admin =="
EDGE_NETWORK="$EDGE_NETWORK" docker compose -f "$OPT/compose.yml" up -d
sleep 2
docker exec "$EDGE" wget -q -O /dev/null http://zerone-admin:80/ 2>/dev/null \
  && echo "edge 連得到 zerone-admin" \
  || echo "!! edge 還連不到 zerone-admin，請把 sudo docker logs zerone-admin-zerone-admin-1 給 Claude 看"

echo "== 4. edge Caddyfile 加上 /admin/ =="
if grep -q 'zerone-admin:80' "$CADDYFILE"; then
  echo "已經設定過，略過。"
else
  if ! grep -qE '^[[:space:]]*@devtools[[:space:]]+host' "$CADDYFILE"; then
    echo "!! Caddyfile 裡找不到 @devtools，沒有修改。請把 Caddyfile 給 Claude 看。"
    exit 1
  fi
  NEW="$(mktemp)"
  awk -v snip="$HERE/edge-caddy-snippet.caddy" '
    /^[[:space:]]*@devtools[[:space:]]+host/ && !done { while ((getline l < snip) > 0) print l; done = 1 }
    { print }
  ' "$CADDYFILE" > "$NEW"
  echo "要做的修改（- 原本、+ 新增）："
  diff -u "$CADDYFILE" "$NEW" || true
  if [ "$ASSUME_YES" != yes ]; then
    read -r -p "這是 Terry 的 edge 設定，確定要修改嗎？（輸入 y 同意）" ans < /dev/tty
    [ "$ans" = y ] || { echo "沒有修改 Caddyfile。其他步驟已完成。"; rm -f "$NEW"; exit 0; }
  fi
  BACKUP="/root/zerone-caddy-backup-$(date +%Y%m%d%H%M%S)"
  mkdir -p "$BACKUP"
  cp -p "$CADDYFILE" "$BACKUP/Caddyfile"
  echo "原檔備份在 $BACKUP/Caddyfile"
  docker cp "$NEW" "$EDGE:/tmp/Caddyfile.zerone" >/dev/null
  if ! docker exec "$EDGE" caddy validate --config /tmp/Caddyfile.zerone --adapter caddyfile; then
    echo "!! 新設定驗證失敗，沒有修改。請把上面的錯誤訊息給 Claude 看。"
    rm -f "$NEW"; exit 1
  fi
  # 用 cat 寫回同一個檔案：Caddyfile 是單一檔案掛載，換掉檔案（例如 sed -i）容器會看不到新內容
  cat "$NEW" > "$CADDYFILE"
  rm -f "$NEW"
  if docker exec "$EDGE" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    echo "edge 已重新載入（不會斷線）。"
  else
    echo "!! 重新載入失敗，還原原本的 Caddyfile。"
    cat "$BACKUP/Caddyfile" > "$CADDYFILE"
    docker exec "$EDGE" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
    exit 1
  fi
fi

echo "== 5. 檢查 =="
if [ -n "$BASE_DOMAIN" ]; then
  H="devtools.$BASE_DOMAIN"
  for p in /admin/ /; do
    code="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$H:443:127.0.0.1" "https://$H$p" || true)"
    echo "https://$H$p → $code"
  done
fi
cat <<MSG

================ 完成 ================
- 網址：https://devtools.${BASE_DOMAIN:-<BASE_DOMAIN>}/admin/
- 之後推到 main，GitHub Actions 會發布新版本，這台 VM 2 分鐘內自動更新。
- 看更新紀錄：sudo journalctl -u zerone-admin-update --since today
- 重要：Caddyfile 是 Terry 的設定。請請他把 deploy/edge-caddy-snippet.caddy 這段
  加進他自己的設定來源，不然他下次部署時可能會被蓋掉。
======================================
MSG
