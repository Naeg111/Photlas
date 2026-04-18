#!/bin/bash
#
# WAF Count <-> Block モード切替スクリプト (Issue#94)
#
# 一操作で以下をまとめて切り替える:
#   1. WebACL の全ルール (AuthRateLimit / GeneralRateLimit / StagingLooseLimit)
#      の Action を Count <-> Block + CustomResponse(429) に変更
#   2. CloudWatch アラームを CountedRequests <-> BlockedRequests に差し替え
#      （ケース α: 3 ルール各 1 本、合計 3 本）
#
# 使い方:
#   ./scripts/switch-waf-block-mode.sh block   # Count -> Block (本番切替)
#   ./scripts/switch-waf-block-mode.sh count   # Block -> Count (ロールバック)
#
# 前提:
#   - ./scripts/setup-waf.sh と ./scripts/setup-waf-alarms.sh が実行済み
#   - block モード切替前に 1〜2 週間の Count モード観測で誤検知がないことを確認済み
#
# ロールバック (Block -> Count):
#   - 本スクリプトを 'count' 引数で再実行すれば WebACL とアラームをまとめて戻せる
#   - 即時 ALB から切り離したい場合:
#       aws wafv2 disassociate-web-acl --resource-arn <ALB_ARN> --region ap-northeast-1
#

set -euo pipefail

# -----------------------------------------------------------------------------
# 引数パース
# -----------------------------------------------------------------------------

usage() {
  cat <<USAGE
Usage: $0 <count|block>

  count   Switch WAF rules to Count mode (rollback from Block)
  block   Switch WAF rules to Block + HTTP 429 (production cutover)
USAGE
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

MODE="$1"
case "$MODE" in
  count|block) ;;
  *)
    echo "Invalid mode: $MODE" >&2
    usage
    ;;
esac

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

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

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

create_mode_alarm() {
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

section "Pre-flight check (mode: $MODE)"

WEBACL_ID="$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].Id | [0]" \
  --output text)"

if [ -z "$WEBACL_ID" ] || [ "$WEBACL_ID" = "None" ]; then
  echo "ERROR: WebACL '$WEBACL_NAME' not found." >&2
  exit 1
fi
log "WebACL: $WEBACL_NAME (ID: $WEBACL_ID)"

SNS_TOPIC_ARN="$(aws sns list-topics \
  --region "$AWS_REGION" \
  --query "Topics[?contains(TopicArn, '${SNS_TOPIC_NAME}')].TopicArn | [0]" \
  --output text)"

if [ -z "$SNS_TOPIC_ARN" ] || [ "$SNS_TOPIC_ARN" = "None" ]; then
  echo "ERROR: SNS topic '$SNS_TOPIC_NAME' not found." >&2
  echo "Run ./scripts/setup-waf-alarms.sh first." >&2
  exit 1
fi
log "SNS topic: $SNS_TOPIC_ARN"

# 確認プロンプト
if [ "$MODE" = "block" ]; then
  cat <<EOF

WARNING: This will switch the WAF from Count mode to Block mode.
Blocked requests will return HTTP 429 with Retry-After: 60.

  WebACL: $WEBACL_NAME
  Region: $AWS_REGION

Have you observed Count mode metrics for 1-2 weeks without false positives?
EOF
else
  cat <<EOF

This will roll the WAF back from Block mode to Count mode.
Rate-limit hits will be counted only (no request will be blocked).

  WebACL: $WEBACL_NAME
  Region: $AWS_REGION
EOF
fi
read -r -p "Type 'yes' to proceed: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# -----------------------------------------------------------------------------
# 1. WebACL のルール Action を切り替え
# -----------------------------------------------------------------------------

section "Step 1: Update WebACL rules (mode: $MODE)"

log "Fetching current WebACL definition"
CURRENT_JSON="$(aws wafv2 get-web-acl \
  --region "$AWS_REGION" \
  --name "$WEBACL_NAME" \
  --scope REGIONAL \
  --id "$WEBACL_ID")"

LOCK_TOKEN="$(echo "$CURRENT_JSON" | jq -r '.LockToken')"
log "Lock token: $LOCK_TOKEN"

if [ "$MODE" = "block" ]; then
  # 全ルール Action を Block + CustomResponse(429) に書き換え
  echo "$CURRENT_JSON" | jq '.WebACL.Rules | map(.Action = {
    "Block": {
      "CustomResponse": {
        "ResponseCode": 429,
        "CustomResponseBodyKey": "RateLimitExceeded",
        "ResponseHeaders": [
          {"Name": "Retry-After", "Value": "60"}
        ]
      }
    }
  })' > "$TMP_DIR/webacl-rules.json"
else
  # 全ルール Action を Count に戻す
  echo "$CURRENT_JSON" | jq '.WebACL.Rules | map(.Action = {"Count": {}})' \
    > "$TMP_DIR/webacl-rules.json"
fi

# WebACL の CustomResponseBodies は毎回明示的に書き出す
# （既存 WebACL から抽出する方式は null を返す可能性があるため避ける）
cat > "$TMP_DIR/custom-response-bodies.json" <<'EOF'
{
  "RateLimitExceeded": {
    "ContentType": "APPLICATION_JSON",
    "Content": "{\"error\":\"Too Many Requests\",\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please retry after some time.\",\"retryAfter\":60}"
  }
}
EOF

log "Updating WebACL (all rules -> $MODE)"
aws wafv2 update-web-acl \
  --region "$AWS_REGION" \
  --name "$WEBACL_NAME" \
  --scope REGIONAL \
  --id "$WEBACL_ID" \
  --lock-token "$LOCK_TOKEN" \
  --default-action '{"Allow": {}}' \
  --rules "file://$TMP_DIR/webacl-rules.json" \
  --custom-response-bodies "file://$TMP_DIR/custom-response-bodies.json" \
  --visibility-config '{
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "photlas-waf-main"
  }'

log "WebACL updated to $MODE mode"

# -----------------------------------------------------------------------------
# 2. CloudWatch アラームを差し替え (CountedRequests <-> BlockedRequests)
# -----------------------------------------------------------------------------

section "Step 2: Replace CloudWatch alarms"

if [ "$MODE" = "block" ]; then
  NEW_METRIC="BlockedRequests"
  OLD_METRIC="CountedRequests"
else
  NEW_METRIC="CountedRequests"
  OLD_METRIC="BlockedRequests"
fi

# 新アラーム 3 本を作成 (ケース α: 3 ルール x 1 本)
create_mode_alarm \
  "photlas-waf-AuthRateLimit-${NEW_METRIC}" \
  "AuthRateLimit" \
  5 \
  "$NEW_METRIC" \
  "$TAG_ENVIRONMENT" \
  "Issue#94: WAF AuthRateLimit rule $NEW_METRIC ($MODE mode)"

create_mode_alarm \
  "photlas-waf-GeneralRateLimit-${NEW_METRIC}" \
  "GeneralRateLimit" \
  20 \
  "$NEW_METRIC" \
  "$TAG_ENVIRONMENT" \
  "Issue#94: WAF GeneralRateLimit rule $NEW_METRIC ($MODE mode)"

create_mode_alarm \
  "photlas-waf-StagingLooseLimit-${NEW_METRIC}" \
  "StagingLooseLimit" \
  50 \
  "$NEW_METRIC" \
  "staging" \
  "Issue#94: WAF StagingLooseLimit rule $NEW_METRIC ($MODE mode)"

# 旧アラーム 3 本を削除 (delete-alarms は存在しない名前でもエラーにならない)
log "Deleting old $OLD_METRIC alarms"
aws cloudwatch delete-alarms \
  --region "$AWS_REGION" \
  --alarm-names \
    "photlas-waf-AuthRateLimit-${OLD_METRIC}" \
    "photlas-waf-GeneralRateLimit-${OLD_METRIC}" \
    "photlas-waf-StagingLooseLimit-${OLD_METRIC}"

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "$MODE mode switch complete"

if [ "$MODE" = "block" ]; then
  cat <<EOF

WAF is now in Block mode.

  Blocked requests will receive:
    HTTP/1.1 429 Too Many Requests
    Retry-After: 60
    Content-Type: application/json

    {"error":"Too Many Requests","code":"RATE_LIMIT_EXCEEDED","message":"Too many requests. Please retry after some time.","retryAfter":60}

Monitoring:
  - CloudWatch alarms now watch BlockedRequests metric
  - Alerts will still go to SNS topic: ${SNS_TOPIC_NAME}

Rollback (if issues occur):
  Immediate detach:
    ALB_ARN=\$(aws elbv2 describe-load-balancers --names photlas-alb \\
      --query 'LoadBalancers[0].LoadBalancerArn' --output text)
    aws wafv2 disassociate-web-acl --resource-arn \$ALB_ARN --region ${AWS_REGION}

  Revert rules + alarms to Count mode:
    ./scripts/switch-waf-block-mode.sh count
EOF
else
  cat <<EOF

WAF is now back in Count mode.

  All rules are counting only; no requests will be blocked.
  CloudWatch alarms now watch CountedRequests metric.
  SNS topic: ${SNS_TOPIC_NAME}
EOF
fi
