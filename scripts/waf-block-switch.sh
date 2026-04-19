#!/bin/bash
#
# AWS WAF マネージドルール 単一ルール単位 Count <-> Block 切替スクリプト (Issue#97)
#
# Issue#94 の switch-waf-block-mode.sh が「全ルールをまとめて」切り替えるのに対し、
# 本スクリプトは Issue#97 で追加したマネージドルール 4 種のうち 1 本ずつを
# Count -> Block / Block -> Count に切り替える (§3.3, §3.5 PR2-4 段階的リリース)。
#
# 実行内容:
#   1. WebACL 内の対象マネージドルール 1 本の OverrideAction を切り替える:
#        block -> OverrideAction を削除することで、setup-waf.sh が
#                 事前設定した RuleActionOverrides (Block + 429 + CustomResponse)
#                 がアクティベートされる (§3.3)
#        count -> OverrideAction: { Count: {} } をセット (ロールバック)
#   2. 対応する CloudWatch アラームを差し替える:
#        block -> photlas-waf-<ShortName>-Blocked (BlockedRequests を監視)
#        count -> photlas-waf-<ShortName>-Counted (CountedRequests を監視)
#      旧メトリクスのアラームは delete-alarms で削除
#
# 使い方:
#   ./scripts/waf-block-switch.sh <count|block> <rule-name>
#
#   <rule-name> は以下のいずれか (setup-waf.sh 内の表示名と一致):
#     CommonRuleSet
#     KnownBadInputsRuleSet
#     SQLiRuleSet
#     AmazonIpReputationList
#
# 例:
#   ./scripts/waf-block-switch.sh block SQLiRuleSet         # SQLi を Block に切替
#   ./scripts/waf-block-switch.sh block AmazonIpReputationList
#   ./scripts/waf-block-switch.sh count CommonRuleSet       # CommonRuleSet を Count に戻す
#
# 前提:
#   - ./scripts/setup-waf.sh 実行済み (Section 2 マネージドルールが Count モードで導入済)
#   - ./scripts/setup-waf-managed-rules-alarm.sh 実行済み (Count 用アラーム 4 本あり)
#   - SNS トピック photlas-waf-alerts (Issue#94) 既存
#
# 関連ドキュメント:
#   documents/04_Issues/Issue#97.md §3.3, §3.5, §3.6
#

set -euo pipefail

# -----------------------------------------------------------------------------
# 引数パース
# -----------------------------------------------------------------------------

usage() {
  cat <<USAGE
Usage: $0 <count|block> <rule-name>

  mode:
    count   Set OverrideAction: {"Count": {}} on the rule (rollback)
    block   Remove OverrideAction so RuleActionOverrides (Block + 429) activate

  rule-name (one of):
    CommonRuleSet
    KnownBadInputsRuleSet
    SQLiRuleSet
    AmazonIpReputationList

Example:
  $0 block SQLiRuleSet
  $0 count CommonRuleSet
USAGE
  exit 1
}

if [ $# -lt 2 ]; then
  usage
fi

MODE="$1"
RULE_NAME="$2"

case "$MODE" in
  count|block) ;;
  *)
    echo "Invalid mode: $MODE" >&2
    usage
    ;;
esac

# rule-name to alarm short-name mapping
# setup-waf.sh の MetricName (= WebACL 内ルール Name) と
# setup-waf-managed-rules-alarm.sh のアラーム名規則を突き合わせる。
case "$RULE_NAME" in
  CommonRuleSet)           ALARM_SHORT_NAME="CommonRuleSet";   THRESHOLD=50  ;;
  KnownBadInputsRuleSet)   ALARM_SHORT_NAME="KnownBadInputs";  THRESHOLD=20  ;;
  SQLiRuleSet)             ALARM_SHORT_NAME="SQLi";            THRESHOLD=5   ;;
  AmazonIpReputationList)  ALARM_SHORT_NAME="IpReputation";    THRESHOLD=100 ;;
  *)
    echo "unknown rule-name: $RULE_NAME" >&2
    usage
    ;;
esac

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

AWS_REGION="ap-northeast-1"
WEBACL_NAME="photlas-waf-main"
SNS_TOPIC_NAME="photlas-waf-alerts"

# リソースタグ (Issue#97 §3.5):
#   Project=Photlas
#   Environment=production
#   ManagedBy=Issue-97     (AWS タグ値に '#' は使えないためハイフン表記)
#   CostCenter=waf
TAG_PROJECT="Photlas"
TAG_ENVIRONMENT="production"
TAG_MANAGED_BY="Issue-97"
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

# CloudWatch アラームを作成 (put-metric-alarm は冪等)
create_managed_rule_alarm() {
  local alarm_name="$1"
  local rule_name="$2"
  local threshold="$3"
  local metric_name="$4"
  local description="$5"

  log "Creating alarm: $alarm_name (metric=$metric_name threshold=$threshold)"
  aws cloudwatch put-metric-alarm \
    --region "$AWS_REGION" \
    --alarm-name "$alarm_name" \
    --alarm-description "$description" \
    --metric-name "$metric_name" \
    --namespace "AWS/WAFV2" \
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
      "Key=Environment,Value=${TAG_ENVIRONMENT}" \
      "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
      "Key=CostCenter,Value=${TAG_COST_CENTER}"
}

# -----------------------------------------------------------------------------
# 事前チェック
# -----------------------------------------------------------------------------

section "Pre-flight check (mode=$MODE rule=$RULE_NAME)"

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
  --query "Topics[?contains(TopicArn, ':${SNS_TOPIC_NAME}')].TopicArn | [0]" \
  --output text)"

if [ -z "$SNS_TOPIC_ARN" ] || [ "$SNS_TOPIC_ARN" = "None" ]; then
  echo "ERROR: SNS topic '$SNS_TOPIC_NAME' not found." >&2
  echo "Run ./scripts/setup-waf-alarms.sh (Issue#94) first." >&2
  exit 1
fi
log "SNS topic: $SNS_TOPIC_ARN"

# 確認プロンプト (誤って Block 切替しないように)
if [ "$MODE" = "block" ]; then
  cat <<EOF

WARNING: This will switch $RULE_NAME from Count to Block mode.
Blocked sub-rules will return HTTP 429 + Retry-After: 60 + RateLimitExceeded body.

  WebACL: $WEBACL_NAME
  Rule:   $RULE_NAME
  Region: $AWS_REGION

Have you observed Count-mode metrics for 1-2 weeks without false positives?
EOF
else
  cat <<EOF

This will roll $RULE_NAME back from Block to Count mode (no blocking).

  WebACL: $WEBACL_NAME
  Rule:   $RULE_NAME
  Region: $AWS_REGION
EOF
fi
read -r -p "Type 'yes' to proceed: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# -----------------------------------------------------------------------------
# 1. WebACL 内の対象マネージドルールの OverrideAction を切り替え
# -----------------------------------------------------------------------------

section "Step 1: Update WebACL rule $RULE_NAME (mode: $MODE)"

log "Fetching current WebACL (for LockToken and rules)"
CURRENT_JSON="$(aws wafv2 get-web-acl \
  --region "$AWS_REGION" \
  --name "$WEBACL_NAME" \
  --scope REGIONAL \
  --id "$WEBACL_ID")"

LOCK_TOKEN="$(echo "$CURRENT_JSON" | jq -r '.LockToken')"
log "LockToken: $LOCK_TOKEN"

# 対象ルールの存在チェック
if ! echo "$CURRENT_JSON" | jq -e --arg n "$RULE_NAME" '.WebACL.Rules | map(select(.Name == $n)) | length > 0' >/dev/null; then
  echo "ERROR: rule '$RULE_NAME' not found in WebACL '$WEBACL_NAME'." >&2
  echo "Run ./scripts/setup-waf.sh first (this creates Section 2 managed rules)." >&2
  exit 1
fi

# 対象ルールの OverrideAction を切り替える:
#   block -> del(.OverrideAction)  ... RuleActionOverrides がアクティベート (§3.3)
#   count -> .OverrideAction = { "Count": {} }  ... ロールバック
if [ "$MODE" = "block" ]; then
  echo "$CURRENT_JSON" \
    | jq --arg n "$RULE_NAME" '.WebACL.Rules | map(
        if .Name == $n then del(.OverrideAction) else . end
      )' \
    > "$TMP_DIR/webacl-rules.json"
else
  echo "$CURRENT_JSON" \
    | jq --arg n "$RULE_NAME" '.WebACL.Rules | map(
        if .Name == $n then .OverrideAction = { "Count": {} } else . end
      )' \
    > "$TMP_DIR/webacl-rules.json"
fi

# CustomResponseBodies は明示的に書き出す (Issue#94 setup-waf.sh と同じ構造)。
cat > "$TMP_DIR/custom-response-bodies.json" <<'EOF'
{
  "RateLimitExceeded": {
    "ContentType": "APPLICATION_JSON",
    "Content": "{\"error\":\"Too Many Requests\",\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please retry after some time.\",\"retryAfter\":60}"
  }
}
EOF

log "Updating WebACL ($RULE_NAME -> $MODE)"
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
log "WebACL updated ($RULE_NAME -> $MODE)"

# -----------------------------------------------------------------------------
# 2. CloudWatch アラームを差し替え (CountedRequests <-> BlockedRequests)
# -----------------------------------------------------------------------------

section "Step 2: Replace CloudWatch alarm for $RULE_NAME"

if [ "$MODE" = "block" ]; then
  NEW_METRIC="BlockedRequests"
  NEW_SUFFIX="Blocked"
  OLD_SUFFIX="Counted"
else
  NEW_METRIC="CountedRequests"
  NEW_SUFFIX="Counted"
  OLD_SUFFIX="Blocked"
fi

NEW_ALARM_NAME="photlas-waf-${ALARM_SHORT_NAME}-${NEW_SUFFIX}"
OLD_ALARM_NAME="photlas-waf-${ALARM_SHORT_NAME}-${OLD_SUFFIX}"

create_managed_rule_alarm \
  "$NEW_ALARM_NAME" \
  "$RULE_NAME" \
  "$THRESHOLD" \
  "$NEW_METRIC" \
  "Issue#97: WAF $RULE_NAME $NEW_METRIC ($MODE mode)"

log "Deleting old alarm: $OLD_ALARM_NAME"
aws cloudwatch delete-alarms \
  --region "$AWS_REGION" \
  --alarm-names "$OLD_ALARM_NAME"

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "$MODE mode switch complete ($RULE_NAME)"

if [ "$MODE" = "block" ]; then
  cat <<EOF

$RULE_NAME is now in Block mode.

  Blocked sub-rule hits will receive:
    HTTP/1.1 429 Too Many Requests
    Retry-After: 60
    Content-Type: application/json

    {"error":"Too Many Requests","code":"RATE_LIMIT_EXCEEDED","message":"Too many requests. Please retry after some time.","retryAfter":60}

Monitoring:
  - CloudWatch alarm: $NEW_ALARM_NAME (watches BlockedRequests / $RULE_NAME)
  - SNS topic:        $SNS_TOPIC_NAME

Rollback:
  ./scripts/waf-block-switch.sh count $RULE_NAME
EOF
else
  cat <<EOF

$RULE_NAME is now back in Count mode.

  OverrideAction: {"Count": {}} applied; RuleActionOverrides are dormant.
  CloudWatch alarm: $NEW_ALARM_NAME (watches CountedRequests / $RULE_NAME)
  SNS topic: $SNS_TOPIC_NAME
EOF
fi
