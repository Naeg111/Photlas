#!/bin/bash
#
# AWS WAF アラーム セットアップスクリプト (Issue#94)
# SNS トピック作成、メール購読、CloudWatch アラーム 3 本を作成する
#
# 実行内容:
#   1. SNS トピック photlas-waf-alerts 作成
#   2. メールアドレス購読追加（実行時に ALERT_EMAIL 環境変数で指定、確認メールの承認は手動）
#   3. CloudWatch アラーム 3 本作成（AuthRateLimit / GeneralRateLimit / StagingLooseLimit の CountedRequests）
#
# 使い方:
#   ALERT_EMAIL=support@photlas.jp ./scripts/setup-waf-alarms.sh
#
# 前提:
#   - ./scripts/setup-waf.sh が既に実行済みであり、WebACL 'photlas-waf-main' が存在すること
#
# 備考:
#   - Slack 通知（AWS Chatbot 連携）は別途 AWS コンソールで手動設定
#     → documents/06_運用/08_Slack通知設定.md 参照
#

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

AWS_REGION="ap-northeast-1"
WEBACL_NAME="photlas-waf-main"
SNS_TOPIC_NAME="photlas-waf-alerts"

# 適用するリソースタグ:
#   Project=Photlas
#   Environment=production   (StagingLooseLimit アラームは Environment=staging)
#   ManagedBy=Issue#94
#   CostCenter=waf
TAG_PROJECT="Photlas"
TAG_ENVIRONMENT="production"
TAG_MANAGED_BY="Issue#94"
TAG_COST_CENTER="waf"

if [ -z "${ALERT_EMAIL:-}" ]; then
  echo "ERROR: ALERT_EMAIL environment variable is required"
  echo "Usage: ALERT_EMAIL=support@photlas.jp $0"
  exit 1
fi

# -----------------------------------------------------------------------------
# ヘルパー関数
# -----------------------------------------------------------------------------

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

section() {
  echo ""
  echo "=== $* ==="
}

create_alarm() {
  local alarm_name="$1"
  local rule_name="$2"
  local threshold="$3"
  local metric_name="$4"
  local environment_tag="$5"
  local description="$6"

  log "Creating alarm: $alarm_name"
  aws cloudwatch put-metric-alarm \
    --region "$AWS_REGION" \
    --alarm-name "$alarm_name" \
    --alarm-description "$description" \
    --metric-name "$metric_name" \
    --namespace AWS/WAFV2 \
    --statistic Sum \
    --period 300 \
    --threshold "$threshold" \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --evaluation-periods 1 \
    --treat-missing-data notBreaching \
    --dimensions \
      "Name=WebACL,Value=${WEBACL_NAME}" \
      "Name=Rule,Value=${rule_name}" \
      "Name=Region,Value=${AWS_REGION}" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --ok-actions "$SNS_TOPIC_ARN" \
    --tags \
      "Key=Project,Value=${TAG_PROJECT}" \
      "Key=Environment,Value=${environment_tag}" \
      "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
      "Key=CostCenter,Value=${TAG_COST_CENTER}"
}

# -----------------------------------------------------------------------------
# 事前チェック
# -----------------------------------------------------------------------------

section "Pre-flight check"

log "Region: $AWS_REGION"
log "Alert email: $ALERT_EMAIL"

WEBACL_EXISTS="$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].Id | [0]" \
  --output text)"

if [ -z "$WEBACL_EXISTS" ] || [ "$WEBACL_EXISTS" = "None" ]; then
  echo "ERROR: WebACL '$WEBACL_NAME' not found."
  echo "Run ./scripts/setup-waf.sh first."
  exit 1
fi
log "WebACL found: $WEBACL_NAME (ID: $WEBACL_EXISTS)"

# -----------------------------------------------------------------------------
# 1. SNS トピック
# -----------------------------------------------------------------------------

section "Step 1: SNS topic"

# create-topic は idempotent（既存名なら同じ ARN を返す）
log "Creating/retrieving SNS topic: $SNS_TOPIC_NAME"
SNS_TOPIC_ARN="$(aws sns create-topic \
  --name "$SNS_TOPIC_NAME" \
  --region "$AWS_REGION" \
  --tags \
    "Key=Project,Value=${TAG_PROJECT}" \
    "Key=Environment,Value=${TAG_ENVIRONMENT}" \
    "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
    "Key=CostCenter,Value=${TAG_COST_CENTER}" \
  --query 'TopicArn' --output text)"
log "SNS topic ARN: $SNS_TOPIC_ARN"

# -----------------------------------------------------------------------------
# 2. メール購読
# -----------------------------------------------------------------------------

section "Step 2: Email subscription"

# 既存の購読を確認
EXISTING_SUB="$(aws sns list-subscriptions-by-topic \
  --region "$AWS_REGION" \
  --topic-arn "$SNS_TOPIC_ARN" \
  --query "Subscriptions[?Protocol=='email' && Endpoint=='${ALERT_EMAIL}'].SubscriptionArn | [0]" \
  --output text)"

if [ -n "$EXISTING_SUB" ] && [ "$EXISTING_SUB" != "None" ]; then
  if [ "$EXISTING_SUB" = "PendingConfirmation" ]; then
    log "Email subscription already exists but is pending confirmation"
    log "Please check the inbox of $ALERT_EMAIL and click the Confirm subscription link"
  else
    log "Email subscription already confirmed: $EXISTING_SUB"
  fi
else
  log "Subscribing $ALERT_EMAIL to SNS topic"
  aws sns subscribe \
    --region "$AWS_REGION" \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALERT_EMAIL"
  log "Subscription request sent. Please check $ALERT_EMAIL for a confirmation email."
fi

# -----------------------------------------------------------------------------
# 3. CloudWatch アラーム
# -----------------------------------------------------------------------------

section "Step 3: CloudWatch alarms (3 alarms)"

# ケース α (3 アラーム) の閾値 (5 分間集計ウィンドウ):
#   --threshold 5  (AuthRateLimit)    — rule limit 100 の 5%
#   --threshold 20 (GeneralRateLimit) — rule limit 2000 の 1%
#   --threshold 50 (StagingLooseLimit) — rule limit 5000 の 1%
create_alarm \
  "photlas-waf-AuthRateLimit-CountedRequests" \
  "AuthRateLimit" \
  5 \
  "CountedRequests" \
  "$TAG_ENVIRONMENT" \
  "Issue#94: WAF AuthRateLimit rule counted requests (Count mode)"

create_alarm \
  "photlas-waf-GeneralRateLimit-CountedRequests" \
  "GeneralRateLimit" \
  20 \
  "CountedRequests" \
  "$TAG_ENVIRONMENT" \
  "Issue#94: WAF GeneralRateLimit rule counted requests (Count mode)"

create_alarm \
  "photlas-waf-StagingLooseLimit-CountedRequests" \
  "StagingLooseLimit" \
  50 \
  "CountedRequests" \
  "staging" \
  "Issue#94: WAF StagingLooseLimit rule counted requests (staging DoS detection)"

# 旧 Block モード用アラームが残っていたら削除（Block → Count ロールバック時の整合性確保）
# delete-alarms は存在しないアラーム名を渡してもエラーにならない
log "Cleaning up any leftover Block-mode alarms (safe to skip if none exist)"
aws cloudwatch delete-alarms \
  --region "$AWS_REGION" \
  --alarm-names \
    "photlas-waf-AuthRateLimit-BlockedRequests" \
    "photlas-waf-GeneralRateLimit-BlockedRequests" \
    "photlas-waf-StagingLooseLimit-BlockedRequests"

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "Setup complete"

cat <<EOF

WAF alarm setup completed successfully.

  SNS topic:      ${SNS_TOPIC_ARN}
  Email:          ${ALERT_EMAIL}
  Alarms:         photlas-waf-AuthRateLimit-CountedRequests
                  photlas-waf-GeneralRateLimit-CountedRequests
                  photlas-waf-StagingLooseLimit-CountedRequests

Next steps:
  1. Open the confirmation email sent to ${ALERT_EMAIL} and click the
     "Confirm subscription" link. Notifications will not be delivered
     until subscription is confirmed.

  2. (Optional) Set up Slack notifications via AWS Chatbot:
     See documents/06_運用/08_Slack通知設定.md for the manual procedure.

  3. Observe for 1-2 weeks in Count mode, then switch to Block mode:
     ./scripts/switch-waf-block-mode.sh

EOF
