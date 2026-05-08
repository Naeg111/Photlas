#!/bin/bash
set -euo pipefail

# Issue#88: S3バケットのCORS設定スクリ���ト
#
# ライトボックスでオリジナル画像を fetch + ReadableStream で読み込むために、
# S3バケットのCORSポリシーを設定する。
#
# 前提条件:
#   - AWS CLIが設定済み
#   - S3バケットが存在する
#
# 使用方法:
#   ./scripts/setup-s3-cors.sh <env>
#   例: ./scripts/setup-s3-cors.sh test
#       ./scripts/setup-s3-cors.sh prod

ENV=${1:-test}
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 環境別設定
if [ "$ENV" = "prod" ]; then
    S3_BUCKET="photlas-uploads-prod-${ACCOUNT_ID}"
    ALLOWED_ORIGINS='["https://photlas.jp"]'
else
    S3_BUCKET="photlas-uploads-test-${ACCOUNT_ID}"
    ALLOWED_ORIGINS='["https://test.photlas.jp","http://localhost:5173","http://localhost:3000"]'
fi

echo "=== S3 CORS設定 (${ENV}) ==="
echo "S3バケット: ${S3_BUCKET}"

# CORS設定を適用
aws s3api put-bucket-cors \
    --bucket "${S3_BUCKET}" \
    --cors-configuration "{
        \"CORSRules\": [
            {
                \"AllowedOrigins\": ${ALLOWED_ORIGINS},
                \"AllowedMethods\": [\"GET\", \"PUT\", \"POST\", \"DELETE\"],
                \"AllowedHeaders\": [\"*\"],
                \"ExposeHeaders\": [\"Content-Length\"],
                \"MaxAgeSeconds\": 3600
            }
        ]
    }" \
    --region "${REGION}"

echo "✅ S3 CORS設定が完了しました"

# 設定確認
echo ""
echo "=== 設定確認 ==="
aws s3api get-bucket-cors \
    --bucket "${S3_BUCKET}" \
    --region "${REGION}" \
    2>/dev/null || echo "⚠️ CORS設定が取得できませんでした"

echo ""
echo "=== 完了 ==="
echo "注意: CloudFrontがOriginヘッダーをS3にフォワードし、"
echo "CORSレスポンスヘッダーをキャッシュキーに含める設定が必要です。"
echo "CloudFrontのキャッシュポリシーで 'Origin' ヘッダーをホワイトリストに追加してください。"
