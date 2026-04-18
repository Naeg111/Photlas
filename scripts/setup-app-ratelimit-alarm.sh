#!/bin/bash
#
# アプリ層レート制限 超過アラーム セットアップスクリプト (Issue#95)
#
# 実行内容:
#   1. CloudWatch Logs メトリクスフィルタを作成
#        - ロググループ: /photlas/prod/backend
#        - フィルタ名:  photlas-app-ratelimit-exceeded-filter
#        - パターン:    "レート制限超過"（RateLimitFilter.handleRateLimitExceeded の warn ログ）
#        - メトリクス:  Photlas/RateLimit / AppLayerExceeded (value=1, default=0)
#   2. CloudWatch アラームを作成
#        - 名前:        photlas-app-ratelimit-exceeded
#        - 閾値:        5 分間 (period=300) の Sum >= 10
#        - SNS 通知:    Issue#94 で作成済みの photlas-waf-alerts を再利用
#        - 欠損データ:  notBreaching
#
# 使い方:
#   ./scripts/setup-app-ratelimit-alarm.sh
#
# 前提:
#   - ./scripts/setup-waf-alarms.sh が実行済みで SNS topic photlas-waf-alerts が存在する
#   - ロググループ /photlas/prod/backend が既に作成されている（本番バックエンドが稼働済み）
#
# 冪等性:
#   - put-metric-filter / put-metric-alarm はともに上書き系 API のため再実行安全
#

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

AWS_REGION="ap-northeast-1"

LOG_GROUP_NAME="/photlas/prod/backend"

METRIC_FILTER_NAME="photlas-app-ratelimit-exceeded-filter"
METRIC_NAMESPACE="Photlas/RateLimit"
METRIC_NAME="AppLayerExceeded"

# RateLimitFilter.handleRateLimitExceeded() が出力する warn ログの先頭文字列
# （CloudWatch Logs のフィルタパターンはダブルクォートで囲むと完全一致扱い）
FILTER_PATTERN='"レート制限超過"'

ALARM_NAME="photlas-app-ratelimit-exceeded"
# 閾値 10 / 評価期間 300 秒（5 分）
# → アプリ層でレート制限を発火させる攻撃が 5 分間に 10 回以上発生したら通報。
#   （put-metric-alarm 呼び出し側には変数展開ではなくリテラルで渡して
#     運用ドキュメント・監査で grep しやすくする）
ALARM_THRESHOLD=10
ALARM_PERIOD=300

# Issue#94 で作成済みの SNS topic 名（新規作成はしない）
SNS_TOPIC_NAME="photlas-waf-alerts"

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

log "Region: $AWS_REGION"

# ロググループ存在確認
LOG_GROUP_EXISTS="$(aws logs describe-log-groups \
  --region "$AWS_REGION" \
  --log-group-name-prefix "$LOG_GROUP_NAME" \
  --query "logGroups[?logGroupName=='${LOG_GROUP_NAME}'].logGroupName | [0]" \
  --output text)"

if [ -z "$LOG_GROUP_EXISTS" ] || [ "$LOG_GROUP_EXISTS" = "None" ]; then
  echo "ERROR: log group '$LOG_GROUP_NAME' not found"
  echo "       Deploy the backend first so the group is auto-created."
  exit 1
fi
log "Log group found: $LOG_GROUP_NAME"

# SNS topic ARN 解決（Issue#94 で作成済みのものを再利用。新規作成はしない）
SNS_TOPIC_ARN="$(aws sns list-topics \
  --region "$AWS_REGION" \
  --query "Topics[?ends_with(TopicArn, ':${SNS_TOPIC_NAME}')].TopicArn | [0]" \
  --output text)"

if [ -z "$SNS_TOPIC_ARN" ] || [ "$SNS_TOPIC_ARN" = "None" ]; then
  echo "ERROR: SNS topic '$SNS_TOPIC_NAME' not found"
  echo "       Run ./scripts/setup-waf-alarms.sh first."
  exit 1
fi
log "SNS topic: $SNS_TOPIC_ARN"

# -----------------------------------------------------------------------------
# 1. メトリクスフィルタ
# -----------------------------------------------------------------------------

section "Step 1: CloudWatch Logs metric filter"

# put-metric-filter は同名のフィルタがあれば上書きする（AlreadyExists は発生しない）
log "Creating/updating metric filter: $METRIC_FILTER_NAME"
aws logs put-metric-filter \
  --region "$AWS_REGION" \
  --log-group-name "$LOG_GROUP_NAME" \
  --filter-name "$METRIC_FILTER_NAME" \
  --filter-pattern "$FILTER_PATTERN" \
  --metric-transformations \
    "metricName=${METRIC_NAME},metricNamespace=${METRIC_NAMESPACE},metricValue=1,defaultValue=0"

# -----------------------------------------------------------------------------
# 2. CloudWatch アラーム
# -----------------------------------------------------------------------------

section "Step 2: CloudWatch alarm"

# put-metric-alarm も同名なら上書き（AlreadyExists は発生しない）
log "Creating/updating alarm: $ALARM_NAME"
aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --alarm-name "$ALARM_NAME" \
  --alarm-description "Issue#95: application-layer rate limit exceeded (>= ${ALARM_THRESHOLD} events / 5 min)" \
  --metric-name "$METRIC_NAME" \
  --namespace "$METRIC_NAMESPACE" \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --treat-missing-data notBreaching \
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

Application rate-limit alarm setup completed successfully.

  Log group:      ${LOG_GROUP_NAME}
  Filter:         ${METRIC_FILTER_NAME}
  Pattern:        ${FILTER_PATTERN}
  Metric:         ${METRIC_NAMESPACE} / ${METRIC_NAME}
  Alarm:          ${ALARM_NAME}
  Threshold:      >= ${ALARM_THRESHOLD} within ${ALARM_PERIOD}s
  SNS topic:      ${SNS_TOPIC_ARN}

Once the backend emits the "レート制限超過" warn log at least ${ALARM_THRESHOLD}
times within a 5-minute window, the alarm will transition to ALARM and
publish to the shared photlas-waf-alerts SNS topic.

EOF
