#!/bin/bash
set -euo pipefail

# Issue#75 + SNS ファンアウト対応:
# S3 → SNS Topic → 複数 Lambda（moderation + thumbnail）の構成で
# 同一プレフィックスへの複数 Lambda トリガーを実現する。
#
# S3 は「同じイベント・同じプレフィックス」で複数の Lambda を直接呼び出せないため、
# SNS Topic を中継してファンアウトする。両 Lambda とも extract_s3_records()
# で SNS ラップを正規化するように対応済み。
#
# 構成:
#   S3 (uploads/, profile-images/) ──→ SNS Topic ─┬→ moderation-scanner Lambda
#                                                 └→ thumbnail-generator Lambda
#                                                    （thumbnail は内部で uploads/ のみ処理）
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
SNS_TOPIC_NAME="photlas-s3-uploads-${FUNCTION_SUFFIX}"

echo "=== S3 → SNS → Lambda ファンアウト設定 (${ENV}) ==="
echo "S3 バケット: ${S3_BUCKET}"
echo "SNS Topic : ${SNS_TOPIC_NAME}"

# --- Lambda 関数の ARN を取得 ---
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

echo "moderation Lambda ARN: ${SCANNER_ARN}"
echo "thumbnail Lambda ARN : ${THUMBNAIL_ARN}"

# --- SNS Topic 作成（既存の場合は ARN だけ取得） ---
echo ""
echo "=== SNS Topic 作成 ==="
SNS_TOPIC_ARN=$(aws sns create-topic \
    --name "$SNS_TOPIC_NAME" \
    --region "$REGION" \
    --query 'TopicArn' \
    --output text)
echo "SNS Topic ARN: ${SNS_TOPIC_ARN}"

# --- SNS Topic ポリシー: S3 からの publish を許可 ---
# S3 がこの SNS Topic に publish できるよう、Topic 自体のポリシーで許可する
echo ""
echo "=== SNS Topic ポリシー設定（S3 からの publish 許可） ==="
SNS_POLICY=$(cat <<POLICY_EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3Publish",
      "Effect": "Allow",
      "Principal": { "Service": "s3.amazonaws.com" },
      "Action": "sns:Publish",
      "Resource": "${SNS_TOPIC_ARN}",
      "Condition": {
        "ArnLike": { "aws:SourceArn": "arn:aws:s3:::${S3_BUCKET}" },
        "StringEquals": { "aws:SourceAccount": "${ACCOUNT_ID}" }
      }
    }
  ]
}
POLICY_EOF
)

aws sns set-topic-attributes \
    --topic-arn "$SNS_TOPIC_ARN" \
    --attribute-name Policy \
    --attribute-value "$SNS_POLICY" \
    --region "$REGION"

# --- 各 Lambda に SNS から呼ばれる権限を付与 ---
# AddPermission は冪等でなく重複登録時にエラーになるため、既存を削除してから追加
echo ""
echo "=== Lambda 権限設定（SNS からの invoke 許可） ==="

add_sns_permission_to_lambda() {
    local function_name=$1
    local statement_id="sns-invoke-${SNS_TOPIC_NAME}"

    # 既存ステートメントがあれば削除（再実行時の冪等性のため）
    aws lambda remove-permission \
        --function-name "$function_name" \
        --statement-id "$statement_id" \
        --region "$REGION" \
        2>/dev/null || true

    aws lambda add-permission \
        --function-name "$function_name" \
        --statement-id "$statement_id" \
        --action "lambda:InvokeFunction" \
        --principal "sns.amazonaws.com" \
        --source-arn "$SNS_TOPIC_ARN" \
        --region "$REGION" \
        > /dev/null
    echo "  ${function_name}: 権限を更新"
}

add_sns_permission_to_lambda "$SCANNER_FUNCTION_NAME"
add_sns_permission_to_lambda "$THUMBNAIL_FUNCTION_NAME"

# --- SNS Topic に各 Lambda を Subscribe ---
echo ""
echo "=== SNS Topic への Lambda Subscribe ==="

subscribe_lambda_to_sns() {
    local lambda_arn=$1
    # 既に subscribe 済みの場合は冪等に処理する。
    # 宣言と代入を分けるのは aws CLI の終了コードを失わせないため (SC2155 対応)。
    local existing
    existing=$(aws sns list-subscriptions-by-topic \
        --topic-arn "$SNS_TOPIC_ARN" \
        --region "$REGION" \
        --query "Subscriptions[?Endpoint=='${lambda_arn}'].SubscriptionArn" \
        --output text)
    if [ -n "$existing" ] && [ "$existing" != "None" ]; then
        echo "  ${lambda_arn}: 既に subscribe 済み"
        return
    fi
    aws sns subscribe \
        --topic-arn "$SNS_TOPIC_ARN" \
        --protocol "lambda" \
        --notification-endpoint "$lambda_arn" \
        --region "$REGION" \
        > /dev/null
    echo "  ${lambda_arn}: subscribe 完了"
}

subscribe_lambda_to_sns "$SCANNER_ARN"
subscribe_lambda_to_sns "$THUMBNAIL_ARN"

# --- S3 → SNS の通知設定 ---
# S3 NotificationConfiguration はバケット全体を上書きする API のため、
# uploads/ と profile-images/ を 2 ルールで明示する（プレフィックスが重ならないため
# 「同一イベントタイプで重複しない」ルール構成になり、S3 の制約を満たす）。
echo ""
echo "=== S3 → SNS 通知設定 ==="
S3_NOTIFICATION=$(cat <<NOTIF_EOF
{
  "TopicConfigurations": [
    {
      "Id": "photlas-uploads-to-sns",
      "TopicArn": "${SNS_TOPIC_ARN}",
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
      "Id": "photlas-profile-images-to-sns",
      "TopicArn": "${SNS_TOPIC_ARN}",
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

echo ""
echo "=== 設定完了 ==="
echo "構成:"
echo "  S3 ${S3_BUCKET} (uploads/, profile-images/)"
echo "    └→ SNS ${SNS_TOPIC_NAME}"
echo "          ├→ ${SCANNER_FUNCTION_NAME}     （uploads/, profile-images/ をスキャン）"
echo "          └→ ${THUMBNAIL_FUNCTION_NAME}   （uploads/ のみサムネイル生成）"
