#!/bin/bash
#
# Issue#148: 死活監視 CloudWatch Synthetics canary セットアップスクリプト（冪等）
#
# 本番 photlas.jp の SEO 重要 URL を 30 分おきに外形監視し、退化したらアラートする。
#   - /tags/{slug}?lang=ja        … SSR ランディング（hreflang / canonical / X-Robots-Tag）
#   - /photo-viewer/{id}          … 個別 OGP（og:url / og:image / X-Robots-Tag）
# canary 本体ソース: scripts/canary/{seo-canary.js, checks.mjs}
#
# 実行内容:
#   1. 既存 SNS topic photlas-waf-alerts の存在確認（無ければ fail-fast）＋ confirmed 購読の警告
#   2. アーティファクト用 S3 バケット作成（冪等）
#   3. canary 実行ロール（IAM）作成（冪等）
#   4. canary 本体を zip 化し、create-canary / update-canary（冪等）
#   5. CloudWatch アラーム（SuccessPercent < 100 が 2 回連続）→ photlas-waf-alerts
#
# 使い方:
#   ./scripts/setup-synthetics-canary.sh
#
# 前提:
#   - SNS topic photlas-waf-alerts が存在し、メール購読が confirmed であること
#     （未確認だとアラートが誰にも届かない）。本番アラート集約先として ./scripts/setup-waf-alarms.sh
#     で作成済みのトピックを流用する。
#
# 備考:
#   - 通知先 SNS topic は新設せず流用する（Issue#148 §4.1）。
#   - 発報時の対応手順は scripts/canary/README.md（triage runbook）を参照。

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

AWS_REGION="ap-northeast-1"
SITE_ORIGIN="https://photlas.jp"

CANARY_NAME="photlas-seo-canary"
RUNTIME_VERSION="syn-nodejs-puppeteer-9.1"
SCHEDULE_EXPRESSION="rate(30 minutes)"
HANDLER="seo-canary.handler"

SNS_TOPIC_NAME="photlas-waf-alerts"
ALARM_NAME="photlas-seo-canary-SuccessPercent"
IAM_ROLE_NAME="photlas-synthetics-canary-role"

CANARY_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/canary" && pwd)"

# 適用するリソースタグ（既存 setup-waf-alarms.sh 等の規約に合わせる。'#' は使えないのでハイフン）。
TAG_PROJECT="Photlas"
TAG_ENVIRONMENT="production"
TAG_MANAGED_BY="Issue-148"
TAG_COST_CENTER="monitoring"

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
# 事前情報
# -----------------------------------------------------------------------------

section "Pre-flight"

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
log "Account: $ACCOUNT_ID / Region: $AWS_REGION"

ARTIFACT_BUCKET="photlas-synthetics-artifacts-${ACCOUNT_ID}"
ARTIFACT_S3_LOCATION="s3://${ARTIFACT_BUCKET}/canary/${CANARY_NAME}"

# -----------------------------------------------------------------------------
# 1. SNS topic（流用。存在確認のみ。新規作成はしない）
# -----------------------------------------------------------------------------

section "Step 1: SNS topic (reuse $SNS_TOPIC_NAME)"

SNS_TOPIC_ARN="$(aws sns list-topics \
  --region "$AWS_REGION" \
  --query "Topics[?ends_with(TopicArn, ':${SNS_TOPIC_NAME}')].TopicArn | [0]" \
  --output text)"

if [ -z "$SNS_TOPIC_ARN" ] || [ "$SNS_TOPIC_ARN" = "None" ]; then
  echo "ERROR: SNS topic '$SNS_TOPIC_NAME' not found." >&2
  echo "       Run ./scripts/setup-waf-alarms.sh first (it creates photlas-waf-alerts)." >&2
  exit 1
fi
log "SNS topic ARN: $SNS_TOPIC_ARN"

# confirmed な購読が 1 つも無ければ、発報しても誰にも届かないため警告する。
CONFIRMED_SUBS="$(aws sns list-subscriptions-by-topic \
  --region "$AWS_REGION" \
  --topic-arn "$SNS_TOPIC_ARN" \
  --query "length(Subscriptions[?SubscriptionArn!='PendingConfirmation' && SubscriptionArn!='Deleted'])" \
  --output text)"

if [ "$CONFIRMED_SUBS" = "0" ]; then
  log "WARNING: topic '$SNS_TOPIC_NAME' has no confirmed subscription."
  log "         Alerts will be delivered to no one until a subscription is confirmed."
else
  log "Confirmed subscriptions: $CONFIRMED_SUBS"
fi

# -----------------------------------------------------------------------------
# 2. アーティファクト用 S3 バケット（冪等）
# -----------------------------------------------------------------------------

section "Step 2: Artifacts bucket"

if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" --region "$AWS_REGION" 2>/dev/null; then
  log "Artifacts bucket exists: $ARTIFACT_BUCKET"
else
  log "Creating artifacts bucket: $ARTIFACT_BUCKET"
  aws s3 mb "s3://${ARTIFACT_BUCKET}" --region "$AWS_REGION"
fi

# -----------------------------------------------------------------------------
# 3. canary 実行ロール（IAM、冪等）
# -----------------------------------------------------------------------------

section "Step 3: IAM execution role"

if aws iam get-role --role-name "$IAM_ROLE_NAME" >/dev/null 2>&1; then
  log "IAM role exists: $IAM_ROLE_NAME"
else
  log "Creating IAM role: $IAM_ROLE_NAME"
  TRUST_DOC="$(mktemp)"
  cat > "$TRUST_DOC" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }
  ]
}
JSON
  aws iam create-role \
    --role-name "$IAM_ROLE_NAME" \
    --assume-role-policy-document "file://${TRUST_DOC}" \
    --tags \
      "Key=Project,Value=${TAG_PROJECT}" \
      "Key=Environment,Value=${TAG_ENVIRONMENT}" \
      "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
      "Key=CostCenter,Value=${TAG_COST_CENTER}"
  rm -f "$TRUST_DOC"

  PERM_DOC="$(mktemp)"
  cat > "$PERM_DOC" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::${ARTIFACT_BUCKET}/*", "arn:aws:s3:::${ARTIFACT_BUCKET}"]
    },
    { "Effect": "Allow", "Action": ["s3:ListAllMyBuckets"], "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:/aws/lambda/cwsyn-${CANARY_NAME}-*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData"],
      "Resource": "*",
      "Condition": { "StringEquals": { "cloudwatch:namespace": "CloudWatchSynthetics" } }
    }
  ]
}
JSON
  aws iam put-role-policy \
    --role-name "$IAM_ROLE_NAME" \
    --policy-name "photlas-synthetics-canary-policy" \
    --policy-document "file://${PERM_DOC}"
  rm -f "$PERM_DOC"
fi

ROLE_ARN="$(aws iam get-role --role-name "$IAM_ROLE_NAME" --query 'Role.Arn' --output text)"
log "Execution role ARN: $ROLE_ARN"

# -----------------------------------------------------------------------------
# 4. canary 本体を zip 化し、create / update（冪等）
# -----------------------------------------------------------------------------

section "Step 4: Package and deploy canary"

# Synthetics の nodejs canary はコードを nodejs/node_modules/ 配下に置く必要がある。
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
mkdir -p "$BUILD_DIR/nodejs/node_modules"
cp "$CANARY_SRC_DIR/seo-canary.js" "$BUILD_DIR/nodejs/node_modules/"
cp "$CANARY_SRC_DIR/checks.mjs" "$BUILD_DIR/nodejs/node_modules/"
ZIP_PATH="$BUILD_DIR/canary.zip"
( cd "$BUILD_DIR" && zip -r -q "$ZIP_PATH" nodejs )
log "Packaged canary: $ZIP_PATH (monitoring $SITE_ORIGIN)"

# --code の shorthand 内 ZipFile=fileb:// は CLI がファイルとして読まない（base64 文字列扱い）ため、
# zip を S3 にアップロードして S3Bucket/S3Key で参照する。
CODE_S3_KEY="canary/${CANARY_NAME}/source/canary.zip"
log "Uploading canary code to s3://${ARTIFACT_BUCKET}/${CODE_S3_KEY}"
aws s3 cp "$ZIP_PATH" "s3://${ARTIFACT_BUCKET}/${CODE_S3_KEY}" --region "$AWS_REGION"
CODE_SPEC="S3Bucket=${ARTIFACT_BUCKET},S3Key=${CODE_S3_KEY},Handler=${HANDLER}"

if aws synthetics get-canary --name "$CANARY_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  log "Canary exists; updating: $CANARY_NAME"
  # update-canary は RUNNING 中の canary には使えないため、実行中なら先に停止する（冪等性確保）。
  PRE_STATE="$(aws synthetics get-canary --name "$CANARY_NAME" --region "$AWS_REGION" \
    --query 'Canary.Status.State' --output text)"
  if [ "$PRE_STATE" = "RUNNING" ]; then
    log "Canary is RUNNING; stopping before update..."
    aws synthetics stop-canary --name "$CANARY_NAME" --region "$AWS_REGION"
    for _ in $(seq 1 40); do
      PRE_STATE="$(aws synthetics get-canary --name "$CANARY_NAME" --region "$AWS_REGION" \
        --query 'Canary.Status.State' --output text)"
      case "$PRE_STATE" in STOPPED|READY) break ;; esac
      log "  state: $PRE_STATE (stopping...)"
      sleep 5
    done
  fi
  aws synthetics update-canary \
    --name "$CANARY_NAME" \
    --region "$AWS_REGION" \
    --execution-role-arn "$ROLE_ARN" \
    --runtime-version "$RUNTIME_VERSION" \
    --schedule "Expression=${SCHEDULE_EXPRESSION}" \
    --run-config "TimeoutInSeconds=60" \
    --code "$CODE_SPEC"
else
  log "Creating canary: $CANARY_NAME"
  aws synthetics create-canary \
    --name "$CANARY_NAME" \
    --region "$AWS_REGION" \
    --artifact-s3-location "$ARTIFACT_S3_LOCATION" \
    --execution-role-arn "$ROLE_ARN" \
    --runtime-version "$RUNTIME_VERSION" \
    --schedule "Expression=${SCHEDULE_EXPRESSION}" \
    --run-config "TimeoutInSeconds=60" \
    --code "$CODE_SPEC" \
    --tags "Project=${TAG_PROJECT},Environment=${TAG_ENVIRONMENT},ManagedBy=${TAG_MANAGED_BY},CostCenter=${TAG_COST_CENTER}"
fi

# create-canary / update-canary は CREATING / UPDATING のまま即座に返る。
# RUNNING でない状態（READY/STOPPED）に落ち着くまで待ってから start する（CREATING 中は start 不可）。
log "Waiting for canary to settle (CREATING/UPDATING -> READY)..."
CANARY_STATE=""
for _ in $(seq 1 40); do
  CANARY_STATE="$(aws synthetics get-canary --name "$CANARY_NAME" --region "$AWS_REGION" \
    --query 'Canary.Status.State' --output text)"
  case "$CANARY_STATE" in
    READY|STOPPED|RUNNING) break ;;
    ERROR)
      echo "ERROR: canary entered ERROR state." >&2
      aws synthetics get-canary --name "$CANARY_NAME" --region "$AWS_REGION" --query 'Canary.Status' >&2
      exit 1
      ;;
  esac
  log "  state: $CANARY_STATE (waiting...)"
  sleep 5
done

if [ "$CANARY_STATE" != "RUNNING" ]; then
  log "Starting canary: $CANARY_NAME"
  aws synthetics start-canary --name "$CANARY_NAME" --region "$AWS_REGION"
fi

# -----------------------------------------------------------------------------
# 5. CloudWatch アラーム（SuccessPercent < 100 が 2 回連続 → 発報）
# -----------------------------------------------------------------------------

section "Step 5: CloudWatch alarm"

# put-metric-alarm は同名なら上書き（冪等）。
# 2 回連続失敗で発報（§4.1）。canary が止まると欠損 → breaching で異常検知。
# 復旧時は ok-actions で通知（§4.2）。
log "Creating/updating alarm: $ALARM_NAME"
aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "$ALARM_NAME" \
  --alarm-description "Issue#148: photlas.jp /tags SSR & /photo-viewer OGP death monitoring (fires after 2 consecutive canary failures)" \
  --namespace "CloudWatchSynthetics" \
  --metric-name "SuccessPercent" \
  --dimensions "Name=CanaryName,Value=${CANARY_NAME}" \
  --statistic "Average" \
  --period 1800 \
  --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --threshold 100 \
  --comparison-operator "LessThanThreshold" \
  --treat-missing-data "breaching" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --ok-actions "$SNS_TOPIC_ARN" \
  --tags \
    "Key=Project,Value=${TAG_PROJECT}" \
    "Key=Environment,Value=${TAG_ENVIRONMENT}" \
    "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
    "Key=CostCenter,Value=${TAG_COST_CENTER}"

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "Setup complete"

cat <<EOF

Synthetics canary setup completed.

  Canary:       ${CANARY_NAME} (${SCHEDULE_EXPRESSION}, ${RUNTIME_VERSION})
  Monitors:     ${SITE_ORIGIN}/tags/{slug}?lang=ja , ${SITE_ORIGIN}/photo-viewer/{id}
  Artifacts:    ${ARTIFACT_S3_LOCATION}
  Exec role:    ${IAM_ROLE_NAME}
  Alarm:        ${ALARM_NAME} (SuccessPercent < 100, 2/2 datapoints)
  Notify (SNS): ${SNS_TOPIC_ARN}

Next steps:
  1. Confirm the canary's first run succeeds in the CloudWatch Synthetics console.
  2. (Verification) Temporarily break a condition and confirm the alarm fires.
     See scripts/canary/README.md (triage runbook).
EOF
