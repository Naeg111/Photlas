#!/bin/bash
set -euo pipefail

# Issue#119: AWS Rekognition (DetectLabels) を Photlas backend EC2 から呼び出すための
# IAM 権限セットアップスクリプト。
#
# 既存の PhotlasEC2Role（ステージング・本番共通）に PhotlasRekognitionPolicy を付与する。
# モデレーション用 Lambda 側の rekognition:DetectModerationLabels は別途
# setup-moderation-lambda.sh で設定済み。本スクリプトは backend EC2 用の
# rekognition:DetectLabels を担当。
#
# 前提条件:
#   - AWS CLI が設定済み
#   - PhotlasEC2Role が存在する（ステージング・本番 EC2 が使用中）
#
# 冪等性: 既にポリシーがある場合は no-op（再実行可能）。
#
# 使用方法:
#   ./scripts/setup-rekognition.sh
#
# 環境ごとの分離:
#   ステージングと本番は同じ PhotlasEC2Role を共有しているため、本スクリプトは
#   両方を同時に有効化する。環境を分ける必要が生じた場合はロールを別ける必要あり。

REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_NAME="PhotlasEC2Role"
POLICY_NAME="PhotlasRekognitionPolicy"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

echo "=== AWS Rekognition IAM セットアップ ==="
echo "Region:  ${REGION}"
echo "Account: ${ACCOUNT_ID}"
echo "Role:    ${ROLE_NAME}"
echo "Policy:  ${POLICY_NAME}"
echo ""

# --- ポリシー JSON 定義 ---
POLICY_DOCUMENT=$(cat <<'POLICY_EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowDetectLabels",
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectLabels"
      ],
      "Resource": "*"
    }
  ]
}
POLICY_EOF
)

# --- 1. ポリシー作成（既存なら作成スキップ）---
echo "[1/2] IAM ポリシー ${POLICY_NAME} の作成..."
if aws iam get-policy --policy-arn "${POLICY_ARN}" >/dev/null 2>&1; then
    echo "  → 既存。スキップ。"
else
    aws iam create-policy \
        --policy-name "${POLICY_NAME}" \
        --policy-document "${POLICY_DOCUMENT}" \
        --description "Issue#119: Photlas backend (EC2) から Rekognition DetectLabels を呼び出すためのポリシー" \
        > /dev/null
    echo "  → 作成完了。"
fi

# --- 2. ロールへのアタッチ（既にアタッチ済みならスキップ）---
echo "[2/2] ロール ${ROLE_NAME} へのアタッチ..."
if aws iam list-attached-role-policies --role-name "${ROLE_NAME}" \
        --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}']" --output text \
        | grep -q "${POLICY_NAME}"; then
    echo "  → 既にアタッチ済み。スキップ。"
else
    aws iam attach-role-policy \
        --role-name "${ROLE_NAME}" \
        --policy-arn "${POLICY_ARN}"
    echo "  → アタッチ完了。"
fi

echo ""
echo "=== 完了 ==="
echo "ステージングと本番の EC2 から rekognition:DetectLabels が呼び出せるようになりました。"
echo "ステージング動作確認後、本番もそのまま反映されます（同一ロール）。"
