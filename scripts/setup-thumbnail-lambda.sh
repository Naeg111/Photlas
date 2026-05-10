#!/bin/bash
set -euo pipefail

# Issue#75: サムネイル生成Lambda関数のセットアップスクリプト
# Issue#125: LQIP（低品質プレースホルダー）コールバック対応で環境変数追加
#
# 前提条件:
#   - AWS CLIが設定済み
#   - S3バケットが存在する
#   - python3 と pip が使えること（Pillow/pillow-heif の Linux 用 wheel を取得するため）
#   - Issue#125 のコールバック先として、photlas-moderation-scanner-* Lambda が
#     既にデプロイされている（MODERATION_API_KEY を共用するため）
#
# 使用方法:
#   ./scripts/setup-thumbnail-lambda.sh <env>
#   例: ./scripts/setup-thumbnail-lambda.sh test
#       ./scripts/setup-thumbnail-lambda.sh prod
#
# 注意:
#   S3イベント通知の設定は setup-s3-notifications.sh で一元管理しています。
#   このスクリプト実行後に setup-s3-notifications.sh を実行してください。
#
# 依存ライブラリのバンドル方針:
#   Pillow / pillow-heif は Lambda 実行環境（Amazon Linux x86_64）向けの wheel が必要。
#   開発が Mac (arm64) でも、`--platform manylinux2014_x86_64 --only-binary=:all:` を
#   付けて pip install することで PyPI から Linux 用 wheel をダウンロードして zip に同梱できる。

ENV=${1:-test}
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 環境別設定
if [ "$ENV" = "prod" ]; then
    S3_BUCKET="photlas-uploads-prod-${ACCOUNT_ID}"
    FUNCTION_SUFFIX="prod"
    # Issue#125: LQIP コールバック先（CloudFront 経由・同一オリジン）
    BACKEND_URL="https://photlas.jp"
else
    S3_BUCKET="photlas-uploads-test-${ACCOUNT_ID}"
    FUNCTION_SUFFIX="test"
    BACKEND_URL="https://test.photlas.jp"
fi

FUNCTION_NAME="photlas-thumbnail-generator-${FUNCTION_SUFFIX}"
ROLE_NAME="photlas-thumbnail-lambda-role-${FUNCTION_SUFFIX}"

# Issue#125: API キーは既存の moderation scanner Lambda から取り出して共用する。
# 取得できない場合はプレースホルダにし、ユーザーに手動更新を促す。
MODERATION_FUNCTION_NAME="photlas-moderation-scanner-${FUNCTION_SUFFIX}"
MODERATION_API_KEY=$(aws lambda get-function-configuration \
    --function-name "$MODERATION_FUNCTION_NAME" \
    --query 'Environment.Variables.MODERATION_API_KEY' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "CHANGE_ME")
if [ "$MODERATION_API_KEY" = "CHANGE_ME" ] || [ "$MODERATION_API_KEY" = "None" ]; then
    echo "⚠️  既存の ${MODERATION_FUNCTION_NAME} から MODERATION_API_KEY を取得できません。"
    echo "   後で手動更新が必要です（このスクリプトの末尾の案内を参照）。"
    MODERATION_API_KEY="CHANGE_ME"
fi

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

# 依存ライブラリのバンドル
# Pillow / pillow-heif などの C 拡張は Lambda 実行環境（Amazon Linux x86_64, Python 3.12）の
# ABI に合わせた wheel が必要。`--platform manylinux2014_x86_64 --only-binary=:all:` を指定して
# Mac (arm64) からでも Linux 用 wheel を取得する。
PACKAGE_DIR="/tmp/photlas-thumbnail-package"
echo "=== 依存ライブラリのインストール (${PACKAGE_DIR}) ==="
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"
python3 -m pip install \
    --platform manylinux2014_x86_64 \
    --target "$PACKAGE_DIR" \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade \
    -r requirements.txt

# Lambda 関数本体をパッケージディレクトリにコピー
cp lambda_function.py "$PACKAGE_DIR/"

# zip 作成（パッケージディレクトリの中身をルートに置く形で zip する）
echo "=== zip 作成 ==="
rm -f /tmp/thumbnail-generator.zip
(cd "$PACKAGE_DIR" && zip -r9 /tmp/thumbnail-generator.zip . -x "*.pyc" "__pycache__/*" "*.dist-info/RECORD" > /dev/null)
echo "zip サイズ: $(du -h /tmp/thumbnail-generator.zip | cut -f1)"

aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime python3.12 \
    --handler lambda_function.lambda_handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/thumbnail-generator.zip \
    --timeout 60 \
    --memory-size 512 \
    --environment "Variables={BACKEND_URL=${BACKEND_URL},MODERATION_API_KEY=${MODERATION_API_KEY}}" \
    --region "$REGION" \
    2>/dev/null || {
    echo "関数は既に存在します。コードと設定を更新します。"
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb:///tmp/thumbnail-generator.zip \
        --region "$REGION"
    # Issue#125: 既存関数にも環境変数 + timeout 60s を反映する。
    # update-function-code 完了後に呼ぶ必要があるため、ここでウェイトを入れる。
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION"
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --timeout 60 \
        --environment "Variables={BACKEND_URL=${BACKEND_URL},MODERATION_API_KEY=${MODERATION_API_KEY}}" \
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
echo "Issue#125: 環境変数の設定状況:"
echo "  BACKEND_URL = ${BACKEND_URL}"
if [ "$MODERATION_API_KEY" = "CHANGE_ME" ]; then
    echo "  MODERATION_API_KEY = CHANGE_ME ⚠️  手動更新が必要"
    echo ""
    echo "  バックエンドの moderation.api-key と同じ値を設定してください:"
    echo "    aws lambda update-function-configuration \\"
    echo "      --function-name ${FUNCTION_NAME} \\"
    echo "      --environment 'Variables={BACKEND_URL=${BACKEND_URL},MODERATION_API_KEY=<実際のキー>}' \\"
    echo "      --region ${REGION}"
else
    echo "  MODERATION_API_KEY = ✅ 既存 ${MODERATION_FUNCTION_NAME} から取得して設定済み"
fi
echo ""
echo "注意: S3イベント通知を設定するには、以下を実行してください:"
echo "  ./scripts/setup-s3-notifications.sh ${ENV}"
