#!/bin/bash
#
# AWS WAF マネージドルール用 CloudWatch アラーム セットアップスクリプト (Issue#97)
#
# 実行内容:
#   Count モード期間中、4 つの AWS マネージドルールごとに
#   CountedRequests を監視する CloudWatch アラームを作成する。
#   SNS トピックは Issue#94 で作成済みの photlas-waf-alerts を流用する
#   (新規 SNS は作成しない)。
#
# 作成するアラーム (Issue#97 §3.5):
#   photlas-waf-IpReputation-Counted    閾値: 5 分間で 100 件以上
#   photlas-waf-KnownBadInputs-Counted  閾値: 5 分間で  20 件以上
#   photlas-waf-SQLi-Counted            閾値: 5 分間で   5 件以上
#   photlas-waf-CommonRuleSet-Counted   閾値: 5 分間で  50 件以上
#
# 使い方:
#   ./scripts/setup-waf-managed-rules-alarm.sh
#
# 前提:
#   - ./scripts/setup-waf.sh が既に実行済みで、WebACL photlas-waf-main に
#     Section 2 (マネージドルール 4 種) が Count モードで追加済みであること
#   - SNS トピック photlas-waf-alerts が Issue#94 setup-waf-alarms.sh で作成済み
#
# 冪等性:
#   put-metric-alarm は同名が存在すれば上書き更新する(新規作成と同じ挙動)。
#
# Block モード切替時のアラーム差し替え:
#   ./scripts/waf-block-switch.sh <count|block> <rule-name> を使用する。
#   本スクリプトは Count モード用アラームの初期作成にのみ使用する。
#
# 関連ドキュメント:
#   documents/04_Issues/Issue#97.md §3.5
#

set -euo pipefail

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

# CloudWatch アラームを作成 (put-metric-alarm は冪等: 既存があれば上書き)
#
#   $1 alarm_name    photlas-waf-<RuleShortName>-Counted
#   $2 rule_name     WebACL 内のマネージドルール表示名 (Dimension "Rule" 値)
#   $3 threshold     5 分ウィンドウあたりの閾値
#   $4 description   アラーム説明文
create_managed_rule_alarm() {
  local alarm_name="$1"
  local rule_name="$2"
  local threshold="$3"
  local description="$4"

  log "Creating alarm: $alarm_name (rule=$rule_name threshold=$threshold)"
  aws cloudwatch put-metric-alarm \
    --region "$AWS_REGION" \
    --alarm-name "$alarm_name" \
    --alarm-description "$description" \
    --metric-name "CountedRequests" \
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

section "Pre-flight check"

log "Region: $AWS_REGION"

# WebACL 存在確認
WEBACL_ID="$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].Id | [0]" \
  --output text)"

if [ -z "$WEBACL_ID" ] || [ "$WEBACL_ID" = "None" ]; then
  echo "ERROR: WebACL '$WEBACL_NAME' not found." >&2
  echo "Run ./scripts/setup-waf.sh first (which sets up both Issue#94 rate limit rules and Issue#97 managed rules)." >&2
  exit 1
fi
log "WebACL found: $WEBACL_NAME (ID: $WEBACL_ID)"

# -----------------------------------------------------------------------------
# 1. SNS トピック lookup (Issue#94 既存、新規作成しない)
# -----------------------------------------------------------------------------

section "Step 1: Look up existing SNS topic (Issue#94 reuse)"

# Issue#97 §3.5: 「既存 SNS photlas-waf-alerts (Issue#94 既存) を流用」
# このスクリプトでは create-topic は呼ばず、既存トピックの ARN を取得するのみ。
SNS_TOPIC_ARN="$(aws sns list-topics \
  --region "$AWS_REGION" \
  --query "Topics[?contains(TopicArn, ':${SNS_TOPIC_NAME}')].TopicArn | [0]" \
  --output text)"

if [ -z "$SNS_TOPIC_ARN" ] || [ "$SNS_TOPIC_ARN" = "None" ]; then
  echo "ERROR: SNS topic '$SNS_TOPIC_NAME' not found." >&2
  echo "Run ./scripts/setup-waf-alarms.sh first (Issue#94 alarm setup creates this topic)." >&2
  exit 1
fi
log "SNS topic: $SNS_TOPIC_ARN"

# -----------------------------------------------------------------------------
# 2. CloudWatch アラーム 4 本作成 (Count モード用)
# -----------------------------------------------------------------------------

section "Step 2: CloudWatch alarms (Count mode, 4 alarms)"

# §3.5 の閾値と対象マネージドルール対応:
#   IpReputation    : 100 per 5 min (AWS 脅威インテリジェンス IP リスト)
#   KnownBadInputs  :  20 per 5 min (既知の不正リクエスト)
#   SQLi            :   5 per 5 min (SQL インジェクション特化)
#   CommonRuleSet   :  50 per 5 min (OWASP Top 10 汎用)
#
# アラーム名の RuleShortName は CloudWatch 指標次元 "Rule" の値
# (setup-waf.sh で各マネージドルールの WebACL Name / MetricName として指定した値) と一致させる。

create_managed_rule_alarm \
  "photlas-waf-IpReputation-Counted" \
  "AmazonIpReputationList" \
  100 \
  "Issue#97: WAF AmazonIpReputationList counted requests (Count mode)"

create_managed_rule_alarm \
  "photlas-waf-KnownBadInputs-Counted" \
  "KnownBadInputsRuleSet" \
  20 \
  "Issue#97: WAF KnownBadInputsRuleSet counted requests (Count mode)"

create_managed_rule_alarm \
  "photlas-waf-SQLi-Counted" \
  "SQLiRuleSet" \
  5 \
  "Issue#97: WAF SQLiRuleSet counted requests (Count mode)"

create_managed_rule_alarm \
  "photlas-waf-CommonRuleSet-Counted" \
  "CommonRuleSet" \
  50 \
  "Issue#97: WAF CommonRuleSet counted requests (Count mode)"

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "Setup complete"

cat <<EOF

Issue#97 managed rule Count-mode alarms created.

  WebACL:         ${WEBACL_NAME}
  SNS topic:      ${SNS_TOPIC_ARN}
  Alarms:         photlas-waf-IpReputation-Counted    (>= 100 / 5 min)
                  photlas-waf-KnownBadInputs-Counted  (>=  20 / 5 min)
                  photlas-waf-SQLi-Counted            (>=   5 / 5 min)
                  photlas-waf-CommonRuleSet-Counted   (>=  50 / 5 min)

Next steps:
  1. Observe Count-mode metrics for 1-2 weeks
     (see Issue#97 §4 phase B for Athena analysis queries).
  2. When ready, switch rules to Block mode one at a time:
       ./scripts/waf-block-switch.sh block SQLiRuleSet
       ./scripts/waf-block-switch.sh block AmazonIpReputationList
       ./scripts/waf-block-switch.sh block KnownBadInputsRuleSet
       ./scripts/waf-block-switch.sh block CommonRuleSet
     Each switch also replaces the corresponding alarm to BlockedRequests.

EOF
