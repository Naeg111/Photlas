#!/bin/bash
set -euo pipefail

# Issue#100: S3 ライフサイクルルール設定スクリプト
#
# このスクリプトは S3 バケットの BucketLifecycleConfiguration を
# 「丸ごと上書き」 する API を使用するため、対象バケットに必要な
# 全ルール（既存のコスト最適化ルール + 本 Issue で追加する孤立ファイル削除ルール）を
# このスクリプト内に明示的に記述している。
# AWS コンソール等で個別ルールだけを変更しても、このスクリプトを再実行すれば
# ここに書かれた状態に戻る（リポジトリ = 正解状態）。
#
# 対象ルール（環境ごと）:
#
# test 環境:
#   - delete-test-data: フィルタなし、30 日後にオブジェクト削除（テストデータの自動掃除）
#   - photlas-cleanup-pending-uploads:        uploads/        + status=pending タグ → 1 日後削除
#   - photlas-cleanup-pending-profile-images: profile-images/ + status=pending タグ → 1 日後削除
#   - photlas-cleanup-pending-thumbnails:     thumbnails/     + status=pending タグ → 1 日後削除
#
# prod 環境:
#   - move-to-glacier: フィルタなし、90 日後 STANDARD_IA、180 日後 GLACIER（長期保管コスト最適化）
#   - photlas-cleanup-pending-* （test と同じ 3 ルール）
#
# 使用方法:
#   ./scripts/setup-s3-lifecycle.sh <env>
#   例: ./scripts/setup-s3-lifecycle.sh test
#       ./scripts/setup-s3-lifecycle.sh prod
#
# 注意:
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
PENDING_EXPIRATION_DAYS=1

echo "=== S3 ライフサイクルルール適用 (${ENV}) ==="
echo "S3 バケット : ${S3_BUCKET}"
echo "タグフィルタ: ${TAG_KEY}=${TAG_VALUE_PENDING}"
echo "孤立ファイル削除日数: ${PENDING_EXPIRATION_DAYS} 日"

# Issue#100 で追加する 3 ルール（環境共通）
# status=pending タグが付いたオブジェクトを 1 日後に削除（孤立ファイル回収）
PENDING_CLEANUP_RULES=$(cat <<PENDING_EOF
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
      "Expiration": { "Days": ${PENDING_EXPIRATION_DAYS} }
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
      "Expiration": { "Days": ${PENDING_EXPIRATION_DAYS} }
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
      "Expiration": { "Days": ${PENDING_EXPIRATION_DAYS} }
    }
PENDING_EOF
)

# 環境別の既存ルール（本 Issue 起票時点で存在していたものを保持）
if [ "$ENV" = "test" ]; then
    EXISTING_RULES=$(cat <<TEST_EOF
    {
      "ID": "delete-test-data",
      "Status": "Enabled",
      "Filter": {},
      "Expiration": { "Days": 30 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 7 }
    }
TEST_EOF
)
else
    EXISTING_RULES=$(cat <<PROD_EOF
    {
      "ID": "move-to-glacier",
      "Status": "Enabled",
      "Filter": {},
      "Transitions": [
        { "Days": 90,  "StorageClass": "STANDARD_IA" },
        { "Days": 180, "StorageClass": "GLACIER" }
      ]
    }
PROD_EOF
)
fi

# 完全なライフサイクル設定 JSON を組み立てる
LIFECYCLE_CONFIG=$(cat <<LIFECYCLE_EOF
{
  "Rules": [
${EXISTING_RULES},
${PENDING_CLEANUP_RULES}
  ]
}
LIFECYCLE_EOF
)

# 一時ファイルに書き出してから適用
TMP_FILE=$(mktemp)
echo "$LIFECYCLE_CONFIG" > "$TMP_FILE"
trap 'rm -f "$TMP_FILE"' EXIT

# JSON 構文チェック（適用前に念のため）
if ! python3 -c "import json,sys; json.load(open('$TMP_FILE'))" 2>/dev/null; then
    echo "ERROR: 生成されたライフサイクル設定 JSON が不正です:" >&2
    cat "$TMP_FILE" >&2
    exit 1
fi

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
