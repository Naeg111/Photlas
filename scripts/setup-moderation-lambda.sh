#!/bin/bash
set -euo pipefail

# Issue#54: モデレーション用Lambda関数のセットアップスクリプト
#
# 前提条件:
#   - AWS CLIが設定済み
#   - S3バケットが存在する
#   - Parameter Storeに必要なパラメータが設定済み
#
# 使用方法:
#   ./scripts/setup-moderation-lambda.sh <env>
#   例: ./scripts/setup-moderation-lambda.sh test
#       ./scripts/setup-moderation-lambda.sh prod

ENV=${1:-test}
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# スクリプトのある場所を絶対パスで保持。
# 後段で複数回 cd するため、相対パス (dirname "$0") を毎回使うと cd 後に
# 解決失敗する（既知バグ修正）。
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 環境別設定
if [ "$ENV" = "prod" ]; then
    S3_BUCKET="photlas-uploads-prod-${ACCOUNT_ID}"
    BACKEND_API_URL="https://api.photlas.jp"
    FUNCTION_SUFFIX="prod"
else
    S3_BUCKET="photlas-uploads-test-${ACCOUNT_ID}"
    BACKEND_API_URL="https://test-api.photlas.jp"
    FUNCTION_SUFFIX="test"
fi

SCANNER_FUNCTION_NAME="photlas-moderation-scanner-${FUNCTION_SUFFIX}"
MONITOR_FUNCTION_NAME="photlas-moderation-monitor-${FUNCTION_SUFFIX}"
ROLE_NAME="photlas-moderation-lambda-role-${FUNCTION_SUFFIX}"

echo "=== モデレーションLambdaセットアップ (${ENV}) ==="
echo "S3バケット: ${S3_BUCKET}"
echo "バックエンドAPI: ${BACKEND_API_URL}"

# --- IAMロール作成 ---
echo "=== IAMロール作成 ==="

TRUST_POLICY=$(cat <<'TRUST_EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST_EOF
)

aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "Photlas moderation Lambda execution role (${ENV})" \
    2>/dev/null || echo "ロールは既に存在します"

# CloudWatch Logsポリシーをアタッチ
aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

# Rekognition, S3, SSMの権限をインラインポリシーで付与
INLINE_POLICY=$(cat <<POLICY_EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectModerationLabels"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CopyObject"
      ],
      "Resource": "arn:aws:s3:::${S3_BUCKET}/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/photlas/${ENV}/*"
    }
  ]
}
POLICY_EOF
)

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "photlas-moderation-permissions" \
    --policy-document "$INLINE_POLICY"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "ロールARN: ${ROLE_ARN}"

# ロールがLambdaで使えるようになるまで待機
echo "IAMロールの伝播を待機中..."
sleep 10

# --- スキャン用Lambda作成 ---
echo "=== スキャン用Lambda作成 ==="

cd "$SCRIPT_DIR/../lambda/moderation-scanner"
zip -j /tmp/moderation-scanner.zip lambda_function.py

aws lambda create-function \
    --function-name "$SCANNER_FUNCTION_NAME" \
    --runtime python3.12 \
    --handler lambda_function.lambda_handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/moderation-scanner.zip \
    --timeout 30 \
    --memory-size 256 \
    --environment "Variables={BACKEND_API_URL=${BACKEND_API_URL},MODERATION_API_KEY=CHANGE_ME,SLACK_WEBHOOK_URL=}" \
    --region "$REGION" \
    2>/dev/null || {
    echo "関数は既に存在します。コードを更新します。"
    aws lambda update-function-code \
        --function-name "$SCANNER_FUNCTION_NAME" \
        --zip-file fileb:///tmp/moderation-scanner.zip \
        --region "$REGION"
}

# S3イベントトリガー設定
echo "=== S3イベントトリガー設定 ==="

SCANNER_ARN=$(aws lambda get-function \
    --function-name "$SCANNER_FUNCTION_NAME" \
    --query 'Configuration.FunctionArn' \
    --output text \
    --region "$REGION")

# Lambda実行権限をS3に付与
aws lambda add-permission \
    --function-name "$SCANNER_FUNCTION_NAME" \
    --statement-id "s3-trigger-${ENV}" \
    --action "lambda:InvokeFunction" \
    --principal "s3.amazonaws.com" \
    --source-arn "arn:aws:s3:::${S3_BUCKET}" \
    --region "$REGION" \
    2>/dev/null || echo "権限は既に存在します"

# S3イベント通知設定
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
    }
  ]
}
NOTIF_EOF
)

aws s3api put-bucket-notification-configuration \
    --bucket "$S3_BUCKET" \
    --notification-configuration "$S3_NOTIFICATION" \
    --region "$REGION"

echo "S3イベント通知設定完了"

# --- 監視用Lambda作成 ---
echo "=== 監視用Lambda作成 ==="

cd "$SCRIPT_DIR/../lambda/moderation-monitor"
zip -j /tmp/moderation-monitor.zip lambda_function.py

aws lambda create-function \
    --function-name "$MONITOR_FUNCTION_NAME" \
    --runtime python3.12 \
    --handler lambda_function.lambda_handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/moderation-monitor.zip \
    --timeout 30 \
    --memory-size 128 \
    --environment "Variables={BACKEND_API_URL=${BACKEND_API_URL},MODERATION_API_KEY=CHANGE_ME,SLACK_WEBHOOK_URL=,STALE_THRESHOLD_MINUTES=5}" \
    --region "$REGION" \
    2>/dev/null || {
    echo "関数は既に存在します。コードを更新します。"
    aws lambda update-function-code \
        --function-name "$MONITOR_FUNCTION_NAME" \
        --zip-file fileb:///tmp/moderation-monitor.zip \
        --region "$REGION"
}

# EventBridgeルール設定（5分間隔）
echo "=== EventBridgeルール設定 ==="

MONITOR_ARN=$(aws lambda get-function \
    --function-name "$MONITOR_FUNCTION_NAME" \
    --query 'Configuration.FunctionArn' \
    --output text \
    --region "$REGION")

RULE_NAME="photlas-moderation-monitor-${FUNCTION_SUFFIX}"

aws events put-rule \
    --name "$RULE_NAME" \
    --schedule-expression "rate(5 minutes)" \
    --state ENABLED \
    --description "Photlas PENDING_REVIEW滞留チェック (${ENV})" \
    --region "$REGION"

aws events put-targets \
    --rule "$RULE_NAME" \
    --targets "Id=moderation-monitor,Arn=${MONITOR_ARN}" \
    --region "$REGION"

aws lambda add-permission \
    --function-name "$MONITOR_FUNCTION_NAME" \
    --statement-id "eventbridge-trigger-${ENV}" \
    --action "lambda:InvokeFunction" \
    --principal "events.amazonaws.com" \
    --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}" \
    --region "$REGION" \
    2>/dev/null || echo "権限は既に存在します"

echo "=== セットアップ完了 ==="
echo ""
echo "注意: 以下の環境変数を手動で更新してください:"
echo "  - MODERATION_API_KEY: バックエンドのmoderation.api-keyと同じ値"
echo "  - SLACK_WEBHOOK_URL: Slack Incoming Webhook URL"
echo ""
echo "環境変数の更新コマンド:"
echo "  aws lambda update-function-configuration \\"
echo "    --function-name ${SCANNER_FUNCTION_NAME} \\"
echo "    --environment 'Variables={BACKEND_API_URL=${BACKEND_API_URL},MODERATION_API_KEY=<実際のキー>,SLACK_WEBHOOK_URL=<Webhook URL>}'"
