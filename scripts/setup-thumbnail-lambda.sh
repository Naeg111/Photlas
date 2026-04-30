#!/bin/bash
set -euo pipefail

# Issue#75: サムネイル生成Lambda関数のセットアップスクリプト
#
# 前提条件:
#   - AWS CLIが設定済み
#   - S3バケットが存在する
#   - Pillow, pillow-heifのLambdaレイヤーが作成済み
#
# 使用方法:
#   ./scripts/setup-thumbnail-lambda.sh <env>
#   例: ./scripts/setup-thumbnail-lambda.sh test
#       ./scripts/setup-thumbnail-lambda.sh prod
#
# 注意:
#   S3イベント通知の設定は setup-s3-notifications.sh で一元管理しています。
#   このスクリプト実行後に setup-s3-notifications.sh を実行してください。

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

FUNCTION_NAME="photlas-thumbnail-generator-${FUNCTION_SUFFIX}"
ROLE_NAME="photlas-thumbnail-lambda-role-${FUNCTION_SUFFIX}"

echo "=== サムネイル生成Lambdaセットアップ (${ENV}) ==="
echo "S3バケット: ${S3_BUCKET}"

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
    --description "Photlas thumbnail generator Lambda execution role (${ENV})" \
    2>/dev/null || echo "ロールは既に存在します"

# CloudWatch Logsポリシーをアタッチ
aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

# S3のGetObject/PutObject権限をインラインポリシーで付与
INLINE_POLICY=$(cat <<POLICY_EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:GetObjectTagging",
        "s3:PutObjectTagging"
      ],
      "Resource": "arn:aws:s3:::${S3_BUCKET}/*"
    }
  ]
}
POLICY_EOF
)

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "photlas-thumbnail-permissions" \
    --policy-document "$INLINE_POLICY"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "ロールARN: ${ROLE_ARN}"

# ロールがLambdaで使えるようになるまで待機
echo "IAMロールの伝播を待機中..."
sleep 10

# --- Lambda関数作成 ---
echo "=== サムネイル生成Lambda作成 ==="

cd "$(dirname "$0")/../lambda/thumbnail-generator"
zip -j /tmp/thumbnail-generator.zip lambda_function.py

aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime python3.12 \
    --handler lambda_function.lambda_handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/thumbnail-generator.zip \
    --timeout 30 \
    --memory-size 512 \
    --region "$REGION" \
    2>/dev/null || {
    echo "関数は既に存在します。コードを更新します。"
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb:///tmp/thumbnail-generator.zip \
        --region "$REGION"
}

# Lambda実行権限をS3に付与
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "s3-trigger-${ENV}" \
    --action "lambda:InvokeFunction" \
    --principal "s3.amazonaws.com" \
    --source-arn "arn:aws:s3:::${S3_BUCKET}" \
    --region "$REGION" \
    2>/dev/null || echo "権限は既に存在します"

echo "=== セットアップ完了 ==="
echo ""
echo "注意: S3イベント通知を設定するには、以下を実行してください:"
echo "  ./scripts/setup-s3-notifications.sh ${ENV}"
