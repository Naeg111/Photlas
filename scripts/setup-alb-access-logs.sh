#!/bin/bash
#
# ALB アクセスログ S3 連携セットアップスクリプト (Issue#95)
#
# 実行内容:
#   1. S3 バケット photlas-alb-logs-<ACCOUNT_ID> を作成（SSE-S3・公開ブロック・90 日ライフサイクル）
#   2. バケットポリシーを適用
#        - ap-northeast-1 の ALB ログ配信 AWS アカウント (582318560864) に PutObject を許可
#        - delivery.logs.amazonaws.com サービスプリンシパルに PutObject / GetBucketAcl を許可
#   3. ALB photlas-alb の access_logs.s3.* 属性を有効化
#
# 使い方:
#   ./scripts/setup-alb-access-logs.sh
#
# 前提:
#   - AWS CLI 認証済み（photlas-alb が存在する AWS アカウント）
#   - ALB 名は photlas-alb（本番）である前提
#
# 冪等性:
#   - create-bucket は AlreadyExists なら無視（再実行安全）
#   - put-bucket-encryption / put-public-access-block / put-bucket-lifecycle-configuration /
#     put-bucket-policy / modify-load-balancer-attributes はすべて「最終状態」を指定する API で
#     何度呼んでも同じ結果になる
#

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

AWS_REGION="ap-northeast-1"
ALB_NAME="photlas-alb"
ALB_LOG_PREFIX="photlas-alb"

# ap-northeast-1 の ALB アクセスログ配信に使われる AWS アカウント ID
# https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
ALB_LOG_DELIVERY_ACCOUNT="582318560864"

# 適用するリソースタグ:
#   Project=Photlas
#   Environment=production
#   ManagedBy=Issue-95      (AWS タグ値に '#' は使えないためハイフン表記)
#   CostCenter=observability
TAG_PROJECT="Photlas"
TAG_ENVIRONMENT="production"
TAG_MANAGED_BY="Issue-95"
TAG_COST_CENTER="observability"

# -----------------------------------------------------------------------------
# ヘルパー
# -----------------------------------------------------------------------------

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

section() {
  echo ""
  echo "=== $* ==="
}

# -----------------------------------------------------------------------------
# 事前チェック
# -----------------------------------------------------------------------------

section "Pre-flight check"

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
log "AWS account: $ACCOUNT_ID"
log "Region: $AWS_REGION"

BUCKET_NAME="photlas-alb-logs-${ACCOUNT_ID}"
log "Log bucket: $BUCKET_NAME"

ALB_ARN="$(aws elbv2 describe-load-balancers \
  --region "$AWS_REGION" \
  --names "$ALB_NAME" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || true)"

if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
  echo "ERROR: ALB '$ALB_NAME' not found in region $AWS_REGION"
  exit 1
fi
log "ALB ARN: $ALB_ARN"

# -----------------------------------------------------------------------------
# 1. S3 バケット作成（冪等）
# -----------------------------------------------------------------------------

section "Step 1: S3 log bucket"

# create-bucket は既存の場合 BucketAlreadyOwnedByYou / AlreadyExists を返す。
# 自分が所有しているケースだけを無視して次へ進む。
log "Creating bucket: $BUCKET_NAME"
if aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$AWS_REGION" \
    --create-bucket-configuration "LocationConstraint=${AWS_REGION}" 2>/tmp/alb-logs-create.err; then
  log "Bucket created: $BUCKET_NAME"
else
  if grep -qE 'BucketAlreadyOwnedByYou|already exists' /tmp/alb-logs-create.err; then
    log "Bucket already exists (owned by this account) — continuing"
  else
    cat /tmp/alb-logs-create.err >&2
    exit 1
  fi
fi
rm -f /tmp/alb-logs-create.err

# バケットタグ
log "Tagging bucket"
aws s3api put-bucket-tagging \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --tagging "TagSet=[\
{Key=Project,Value=${TAG_PROJECT}},\
{Key=Environment,Value=${TAG_ENVIRONMENT}},\
{Key=ManagedBy,Value=${TAG_MANAGED_BY}},\
{Key=CostCenter,Value=${TAG_COST_CENTER}}]"

# SSE-S3 暗号化
log "Enabling SSE-S3 (AES256) encryption"
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }
    ]
  }'

# 公開アクセス完全ブロック
log "Blocking all public access"
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 90 日ライフサイクル
log "Applying 90-day lifecycle expiration"
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "photlas-alb-logs-expire-90d",
        "Status": "Enabled",
        "Filter": { "Prefix": "" },
        "Expiration": { "Days": 90 },
        "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
      }
    ]
  }'

# -----------------------------------------------------------------------------
# 2. バケットポリシー
# -----------------------------------------------------------------------------

section "Step 2: Bucket policy"

# ALB アクセスログ配信には 2 系統の主体が必要:
#   - ap-northeast-1 の ALB ログ配信 AWS アカウント (arn:aws:iam::582318560864:root)
#   - サービスプリンシパル delivery.logs.amazonaws.com（新方式）
# 両方許可しておけば旧方式 / 新方式どちらでも配信される。
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSLogDeliveryWrite-AccountPrincipal",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::${ALB_LOG_DELIVERY_ACCOUNT}:root"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/${ALB_LOG_PREFIX}/AWSLogs/${ACCOUNT_ID}/*"
    },
    {
      "Sid": "AWSLogDeliveryWrite-ServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "delivery.logs.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/${ALB_LOG_PREFIX}/AWSLogs/${ACCOUNT_ID}/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control"
        }
      }
    },
    {
      "Sid": "AWSLogDeliveryAclCheck",
      "Effect": "Allow",
      "Principal": {
        "Service": "delivery.logs.amazonaws.com"
      },
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}"
    }
  ]
}
EOF
)

log "Applying bucket policy"
aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --policy "$BUCKET_POLICY"

# -----------------------------------------------------------------------------
# 3. ALB 属性を更新
# -----------------------------------------------------------------------------

section "Step 3: Enable ALB access logs"

log "Enabling access_logs.s3.* attributes on $ALB_NAME"
aws elbv2 modify-load-balancer-attributes \
  --region "$AWS_REGION" \
  --load-balancer-arn "$ALB_ARN" \
  --attributes \
    "Key=access_logs.s3.enabled,Value=true" \
    "Key=access_logs.s3.bucket,Value=${BUCKET_NAME}" \
    "Key=access_logs.s3.prefix,Value=${ALB_LOG_PREFIX}" \
  > /dev/null

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "Setup complete"

cat <<EOF

ALB access log setup completed successfully.

  Bucket:         ${BUCKET_NAME}
  Prefix:         ${ALB_LOG_PREFIX}
  Lifecycle:      90 days
  Encryption:     SSE-S3 (AES256)
  Public access:  Blocked
  ALB:            ${ALB_NAME}

Logs will appear under:
  s3://${BUCKET_NAME}/${ALB_LOG_PREFIX}/AWSLogs/${ACCOUNT_ID}/elasticloadbalancing/${AWS_REGION}/

It may take a few minutes for the first log file to be delivered.

EOF
