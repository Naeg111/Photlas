#!/bin/bash
set -euo pipefail

# Issue#100: S3 ライフサイクルルール設定スクリプト
#
# タグベースのライフサイクルルールにより、status=pending タグ付きで
# 1 日以上経過したオブジェクトを自動削除し、孤立ファイルを回収する。
#
# 対象プレフィックス:
#   - uploads/        : ユーザー投稿写真
#   - profile-images/ : プロフィール画像
#   - thumbnails/     : Lambda 自動生成サムネイル
#
# タグなしの既存ファイル（過去の正常登録ファイルなど）は対象外（影響なし）。
#
# 使用方法:
#   ./scripts/setup-s3-lifecycle.sh <env>
#   例: ./scripts/setup-s3-lifecycle.sh test
#       ./scripts/setup-s3-lifecycle.sh prod
#
# 注意:
#   このスクリプトは S3 バケットの BucketLifecycleConfiguration を
#   "丸ごと上書き" するため、別途設定済みのライフサイクルルールがある場合は
#   先にエクスポートして本スクリプトに統合してから実行すること。
#   イベント通知 (S3 NotificationConfiguration) とは別 API のため、
#   setup-s3-notifications.sh の前後どちらに実行しても影響しない。

ENV=${1:-test}
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 環境別バケット名（setup-thumbnail-lambda.sh と整合）
if [ "$ENV" = "prod" ]; then
    S3_BUCKET="photlas-uploads-prod-${ACCOUNT_ID}"
elif [ "$ENV" = "test" ]; then
    S3_BUCKET="photlas-uploads-test-${ACCOUNT_ID}"
else
    echo "ERROR: env は 'test' か 'prod' を指定してください (指定値: ${ENV})" >&2
    exit 1
fi

# Issue#100: タグ定数（バックエンド S3Service / フロントエンド apiClient.ts /
# Lambda lambda_function.py と値を揃える）
TAG_KEY="status"
TAG_VALUE_PENDING="pending"
EXPIRATION_DAYS=1

echo "=== S3 ライフサイクルルール適用 (${ENV}) ==="
echo "S3 バケット : ${S3_BUCKET}"
echo "タグフィルタ: ${TAG_KEY}=${TAG_VALUE_PENDING}"
echo "削除日数    : ${EXPIRATION_DAYS} 日"

# ライフサイクル設定 JSON を組み立てる
# 3 つのプレフィックスそれぞれに対して、status=pending タグを持つオブジェクトを
# 1 日後に削除するルールを設定する
LIFECYCLE_CONFIG=$(cat <<LIFECYCLE_EOF
{
  "Rules": [
    {
      "ID": "photlas-cleanup-pending-uploads",
      "Status": "Enabled",
      "Filter": {
        "And": {
          "Prefix": "uploads/",
          "Tags": [
            { "Key": "${TAG_KEY}", "Value": "${TAG_VALUE_PENDING}" }
          ]
        }
      },
      "Expiration": { "Days": ${EXPIRATION_DAYS} }
    },
    {
      "ID": "photlas-cleanup-pending-profile-images",
      "Status": "Enabled",
      "Filter": {
        "And": {
          "Prefix": "profile-images/",
          "Tags": [
            { "Key": "${TAG_KEY}", "Value": "${TAG_VALUE_PENDING}" }
          ]
        }
      },
      "Expiration": { "Days": ${EXPIRATION_DAYS} }
    },
    {
      "ID": "photlas-cleanup-pending-thumbnails",
      "Status": "Enabled",
      "Filter": {
        "And": {
          "Prefix": "thumbnails/",
          "Tags": [
            { "Key": "${TAG_KEY}", "Value": "${TAG_VALUE_PENDING}" }
          ]
        }
      },
      "Expiration": { "Days": ${EXPIRATION_DAYS} }
    }
  ]
}
LIFECYCLE_EOF
)

# 一時ファイルに書き出してから適用（標準入力で渡すと長すぎてコマンドラインが切れる場合があるため）
TMP_FILE=$(mktemp)
echo "$LIFECYCLE_CONFIG" > "$TMP_FILE"
trap 'rm -f "$TMP_FILE"' EXIT

aws s3api put-bucket-lifecycle-configuration \
    --bucket "$S3_BUCKET" \
    --lifecycle-configuration "file://${TMP_FILE}" \
    --region "$REGION"

echo "=== 適用結果の確認 ==="
aws s3api get-bucket-lifecycle-configuration \
    --bucket "$S3_BUCKET" \
    --region "$REGION" \
    --output json

echo ""
echo "=== 完了 ==="
echo "S3 ライフサイクルルールが ${S3_BUCKET} に適用されました。"
echo "AWS が 1 日 1 回ライフサイクル評価を実行するため、"
echo "実際の削除は最短約 10 時間〜最長約 34 時間後に開始されます。"
