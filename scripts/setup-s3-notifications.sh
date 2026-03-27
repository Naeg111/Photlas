#!/bin/bash
set -euo pipefail

# Issue#75: S3イベント通知の統合セットアップスクリプト
#
# モデレーションLambdaとサムネイル生成Lambdaの両方のS3トリガーを
# 一括で設定する。put-bucket-notification-configurationはバケット全体の
# 通知設定を上書きするため、このスクリプトで一元管理する。
#
# 前提条件:
#   - setup-moderation-lambda.sh が実行済み
#   - setup-thumbnail-lambda.sh が実行済み
#
# 使用方法:
#   ./scripts/setup-s3-notifications.sh <env>
#   例: ./scripts/setup-s3-notifications.sh test
#       ./scripts/setup-s3-notifications.sh prod

ENV=${1:-test}
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 環境別設定
if [ "$ENV" = "prod" ]; then
    S3_BUCKET="photlas-uploads-prod-${ACCOUNT_ID}"
    FUNCTION_SUFFIX="prod"
else
    S3_BUCKET="photlas-uploads-test-${ACCOUNT_ID}"
    FUNCTION_SUFFIX="test"
fi

SCANNER_FUNCTION_NAME="photlas-moderation-scanner-${FUNCTION_SUFFIX}"
THUMBNAIL_FUNCTION_NAME="photlas-thumbnail-generator-${FUNCTION_SUFFIX}"

echo "=== S3イベント通知の統合設定 (${ENV}) ==="
echo "S3バケット: ${S3_BUCKET}"

# Lambda関数のARNを取得
SCANNER_ARN=$(aws lambda get-function \
    --function-name "$SCANNER_FUNCTION_NAME" \
    --query 'Configuration.FunctionArn' \
    --output text \
    --region "$REGION")

THUMBNAIL_ARN=$(aws lambda get-function \
    --function-name "$THUMBNAIL_FUNCTION_NAME" \
    --query 'Configuration.FunctionArn' \
    --output text \
    --region "$REGION")

echo "モデレーションLambda ARN: ${SCANNER_ARN}"
echo "サムネイルLambda ARN: ${THUMBNAIL_ARN}"

# 統合S3イベント通知設定
# - モデレーション: uploads/ と profile-images/ プレフィックス
# - サムネイル生成: uploads/ プレフィックス
S3_NOTIFICATION=$(cat <<NOTIF_EOF
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "moderation-scan-uploads",
      "LambdaFunctionArn": "${SCANNER_ARN}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "prefix", "Value": "uploads/" }
          ]
        }
      }
    },
    {
      "Id": "moderation-scan-profile-images",
      "LambdaFunctionArn": "${SCANNER_ARN}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "prefix", "Value": "profile-images/" }
          ]
        }
      }
    },
    {
      "Id": "thumbnail-generator-uploads",
      "LambdaFunctionArn": "${THUMBNAIL_ARN}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "prefix", "Value": "uploads/" }
          ]
        }
      }
    }
  ]
}
NOTIF_EOF
)

aws s3api put-bucket-notification-configuration \
    --bucket "$S3_BUCKET" \
    --notification-configuration "$S3_NOTIFICATION" \
    --region "$REGION"

echo "=== S3イベント通知設定完了 ==="
echo ""
echo "設定されたトリガー:"
echo "  uploads/           → モデレーションLambda + サムネイル生成Lambda"
echo "  profile-images/    → モデレーションLambda"
