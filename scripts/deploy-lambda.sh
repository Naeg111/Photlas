#!/bin/bash
# Photlas Lambda コードデプロイ（Issue#147 決定 G 改訂）
#
# Lambda の infra（関数設定・環境変数・権限・トリガー）は Terraform 管理。
# 本スクリプトは「コードの zip & update-function-code」だけを担う。
# （thumbnail は Pillow 等の Linux ネイティブ依存を同梱するため archive_file での
#   Terraform 管理は不適。コードデプロイはこの専用スクリプトに集約する。）
#
# 使い方:
#   ./scripts/deploy-lambda.sh <env> [function]
#     env      : prod | test
#     function : scanner | monitor | thumbnail | all（省略時 all）
#
# 例:
#   ./scripts/deploy-lambda.sh prod thumbnail
#   ./scripts/deploy-lambda.sh test all

set -euo pipefail

REGION="ap-northeast-1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV="${1:-}"
FUNC="${2:-all}"

case "$ENV" in
  prod | test) ;;
  *)
    echo "usage: $0 <prod|test> [scanner|monitor|thumbnail|all]" >&2
    exit 1
    ;;
esac

# 単一ファイル関数（scanner / monitor）: lambda_function.py だけを zip
deploy_single() {
  local dir="$1"
  local fn="$2"
  echo "=== ${fn} (single file) ==="
  local zip="/tmp/${fn}.zip"
  rm -f "$zip"
  (cd "${ROOT}/lambda/${dir}" && zip -j "$zip" lambda_function.py >/dev/null)
  aws lambda update-function-code \
    --region "$REGION" --function-name "$fn" \
    --zip-file "fileb://${zip}" --no-cli-pager >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$fn"
  echo "deployed: ${fn}"
}

# 依存込み関数（thumbnail）: Linux 用 wheel を同梱して zip
deploy_thumbnail() {
  local fn="photlas-thumbnail-generator-${ENV}"
  echo "=== ${fn} (with deps) ==="
  local src="${ROOT}/lambda/thumbnail-generator"
  local pkg
  pkg="$(mktemp -d)"
  # Lambda 実行環境（Amazon Linux x86_64 / Python 3.12）向け wheel を取得（Mac からでも可）
  python3 -m pip install \
    --platform manylinux2014_x86_64 \
    --target "$pkg" \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade \
    -r "${src}/requirements.txt" >/dev/null
  cp "${src}/lambda_function.py" "$pkg/"
  local zip="/tmp/${fn}.zip"
  rm -f "$zip"
  (cd "$pkg" && zip -r9 "$zip" . -x "*.pyc" "__pycache__/*" "*.dist-info/RECORD" >/dev/null)
  rm -rf "$pkg"
  aws lambda update-function-code \
    --region "$REGION" --function-name "$fn" \
    --zip-file "fileb://${zip}" --no-cli-pager >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$fn"
  echo "deployed: ${fn} ($(du -h "$zip" | cut -f1))"
}

if [ "$FUNC" = scanner ] || [ "$FUNC" = all ]; then
  deploy_single moderation-scanner "photlas-moderation-scanner-${ENV}"
fi
if [ "$FUNC" = monitor ] || [ "$FUNC" = all ]; then
  deploy_single moderation-monitor "photlas-moderation-monitor-${ENV}"
fi
if [ "$FUNC" = thumbnail ] || [ "$FUNC" = all ]; then
  deploy_thumbnail
fi

echo "完了"
