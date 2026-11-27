#!/usr/bin/env bash
# 零壹雲管家管理端：VM 定時檢查 GitHub Release 有沒有新版本，有就下載並切換過去。
# 由 systemd 計時器每 2 分鐘以 zerone-deploy 帳號執行（vm-setup.sh 設定）。
# VM 只需要連出去（HTTPS），不用開任何連入的 port。
set -euo pipefail

REPO="${REPO:-a1235678/zerone-gcp-management}"
TAG="${TAG:-admin-latest}"
BASE_URL="${BASE_URL:-https://github.com/$REPO/releases/download/$TAG}"
ROOT="${ROOT:-/var/www/zerone-admin}"
KEEP="${KEEP:-5}"

latest="$(curl -fsSL --retry 2 "$BASE_URL/version.txt" 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "$latest" ]; then
  echo "還沒有發布的版本，或連不到 GitHub（$BASE_URL/version.txt）"
  exit 0
fi
# 版本名稱是「時間-commit」，只接受這個格式（避免奇怪的路徑）
if ! [[ "$latest" =~ ^[0-9]{14}-[0-9a-f]{7,40}$ ]]; then
  echo "版本名稱格式不對：$latest" >&2
  exit 1
fi

current="$(basename "$(readlink "$ROOT/current" 2>/dev/null || echo none)")"
[ "$latest" = "$current" ] && exit 0

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 2 "$BASE_URL/admin.tar.gz" -o "$tmp/admin.tar.gz"
curl -fsSL --retry 2 "$BASE_URL/admin.tar.gz.sha256" -o "$tmp/admin.tar.gz.sha256"
echo "$(tr -d '[:space:]' < "$tmp/admin.tar.gz.sha256")  $tmp/admin.tar.gz" | sha256sum -c --quiet -

# 版本號跟檔案在不同時間上傳，下載完再確認一次版本沒變，避免檔案配錯版本
again="$(curl -fsSL --retry 2 "$BASE_URL/version.txt" | tr -d '[:space:]')"
if [ "$again" != "$latest" ]; then
  echo "下載期間又發布了新版本，下次再更新"
  exit 0
fi

dest="$ROOT/releases/$latest"
rm -rf "$dest.partial"
mkdir -p "$dest.partial"
tar -xzf "$tmp/admin.tar.gz" -C "$dest.partial" --no-same-owner --no-same-permissions
[ -f "$dest.partial/index.html" ] || { echo "壓縮檔裡沒有 index.html" >&2; exit 1; }
chmod -R a+rX "$dest.partial"
rm -rf "$dest"
mv "$dest.partial" "$dest"

# 換 current 連結（瞬間切換），只保留最近 $KEEP 個版本，方便退回
cd "$ROOT"
ln -sfn "releases/$latest" current.tmp
mv -Tf current.tmp current
ls -1dt releases/*/ | grep -v placeholder | tail -n +"$((KEEP + 1))" | xargs -r rm -rf
echo "已更新到 $latest（原本 $current）"
