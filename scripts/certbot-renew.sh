#!/bin/bash
#
# Let's Encrypt SSL証明書の自動更新スクリプト
# systemd timerから定期実行される
#

set -euo pipefail

LOG_PREFIX="[certbot-renew]"

echo "$LOG_PREFIX Starting certificate renewal check..."

# certbotで証明書更新を試行
# --deploy-hook: 更新成功時にnginxコンテナをリロード
certbot renew \
  --quiet \
  --deploy-hook "docker exec photlas-nginx-prod nginx -s reload 2>/dev/null || docker exec photlas-nginx-staging nginx -s reload 2>/dev/null || true"

echo "$LOG_PREFIX Certificate renewal check completed."
