#!/usr/bin/env bash
# VM 一次性設定：讓 GitHub Actions 可以把管理端部署到這台 VM 的 /admin/。
# 用法（在 VM 上）：sudo bash vm-setup.sh
# 可以重複執行：會換一把新的部署金鑰（舊的失效），其他設定不重複加。
set -euo pipefail

DOMAIN="${DOMAIN:-devtools.dev.terrylinla.com}"
DEPLOY_USER="${DEPLOY_USER:-zerone-deploy}"
WEB_ROOT="${WEB_ROOT:-/var/www/zerone-admin}"
SNIPPET=/etc/nginx/snippets/zerone-admin.conf
BACKUP_DIR="/root/zerone-nginx-backup-$(date +%Y%m%d%H%M%S)"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "請用 sudo 執行：sudo bash $0"; exit 1; }

echo "== 1. 安裝 rsync =="
command -v rsync >/dev/null || { apt-get update -qq && apt-get install -y -qq rsync; }

echo "== 2. 建立部署帳號 $DEPLOY_USER（沒有 sudo 權限）與網站目錄 $WEB_ROOT =="
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
mkdir -p "$WEB_ROOT/releases"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$WEB_ROOT"
chmod 755 "$WEB_ROOT" "$WEB_ROOT/releases"
if [ ! -e "$WEB_ROOT/current" ]; then
  mkdir -p "$WEB_ROOT/releases/placeholder"
  echo '<!doctype html><meta charset="utf-8"><title>零壹雲管家</title><p>還沒有部署，請等 GitHub Actions 跑完。</p>' > "$WEB_ROOT/releases/placeholder/index.html"
  ln -sfn releases/placeholder "$WEB_ROOT/current"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$WEB_ROOT"
fi

echo "== 3. 產生 GitHub Actions 專用的 SSH 金鑰 =="
SSH_DIR="/home/$DEPLOY_USER/.ssh"
mkdir -p "$SSH_DIR"
TMP="$(mktemp -d)"
ssh-keygen -q -t ed25519 -N '' -C "github-actions-zerone-admin" -f "$TMP/key"
touch "$SSH_DIR/authorized_keys"
grep -v 'github-actions-zerone-admin' "$SSH_DIR/authorized_keys" > "$TMP/ak" || true
echo "restrict $(cat "$TMP/key.pub")" >> "$TMP/ak"
cp "$TMP/ak" "$SSH_DIR/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR"
chmod 700 "$SSH_DIR"; chmod 600 "$SSH_DIR/authorized_keys"

echo "== 4. nginx 設定 =="
NGINX_DONE=no
if command -v nginx >/dev/null; then
  mkdir -p "$(dirname "$SNIPPET")"
  if [ -f "$HERE/nginx-admin.conf" ]; then cp "$HERE/nginx-admin.conf" "$SNIPPET"; else
    echo "找不到 $HERE/nginx-admin.conf，請把它跟這個腳本放在同一個資料夾"; exit 1; fi
  mapfile -t CONFS < <(grep -RlE "server_name[^;]*\b${DOMAIN//./\\.}\b" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | xargs -r -n1 readlink -f | sort -u)
  if [ "${#CONFS[@]}" -eq 0 ]; then
    echo "!! 找不到 server_name 是 $DOMAIN 的 nginx 設定，請手動在那個 server 區塊加一行：include snippets/zerone-admin.conf;"
  else
    BACKUPS=()
    for f in "${CONFS[@]}"; do
      if grep -q 'snippets/zerone-admin.conf' "$f"; then echo "已經設定過：$f"; continue; fi
      # 備份放在 /root，不能放在 nginx 會載入的資料夾裡
      mkdir -p "$BACKUP_DIR"; cp "$f" "$BACKUP_DIR/$(echo "$f" | tr / _)"; BACKUPS+=("$f")
      # 在每個含這個網域的 server_name 下一行加 include
      sed -i -E "/server_name[^;]*\b${DOMAIN//./\\.}\b[^;]*;/a\\    include snippets/zerone-admin.conf;" "$f"
      echo "已加入 include：$f（原檔備份在 $BACKUP_DIR）"
    done
    if nginx -t; then
      systemctl reload nginx 2>/dev/null || nginx -s reload
      NGINX_DONE=yes
    else
      echo "!! nginx 設定檢查失敗，已還原。請把上面的錯誤訊息給 Claude 看。"
      for f in "${BACKUPS[@]}"; do cp "$BACKUP_DIR/$(echo "$f" | tr / _)" "$f"; done
    fi
  fi
else
  echo "!! 這台 VM 沒有 nginx。$DOMAIN 可能是用別的伺服器（例如 Docker、Caddy）提供，請把狀況告訴 Claude。"
fi

IP="$(curl -sf -m 3 --noproxy '*' -H 'Metadata-Flavor: Google' http://169.254.169.254/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)"
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || IP="(請填 VM 的外部 IP：GCP 主控台 → VM 執行個體 → 外部 IP)"
HOSTKEYS="$(for k in /etc/ssh/ssh_host_*_key.pub; do echo "$IP $(cut -d' ' -f1,2 "$k")"; done)"

cat <<MSG

================ 完成 ================
nginx 設定：$NGINX_DONE
請到 GitHub repo → Settings → Secrets and variables → Actions → New repository secret，新增 4 個 secret：

VM_HOST
$IP

VM_USER
$DEPLOY_USER

VM_KNOWN_HOSTS（整段複製）
$HOSTKEYS

VM_SSH_KEY（整段複製，包含 BEGIN 與 END 兩行；只會顯示這一次）
$(cat "$TMP/key")
======================================
MSG
rm -rf "$TMP"
