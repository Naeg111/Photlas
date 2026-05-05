#!/bin/bash
# Issue#117: メンテナンスモード状態確認 (副作用なし)
#
# CloudFront Function のコメント (maintenance / passthrough) と
# ALB ルール優先度 (active / inactive) から現在の状態を判定する。
#
# 使用方法:
#   ./scripts/maintenance-status.sh <env>
#   例: ./scripts/maintenance-status.sh test
#       ./scripts/maintenance-status.sh prod

set -euo pipefail

ENV="${1:-}"
case "$ENV" in
  prod)
    FUNCTION_NAME="photlas-frontend-fn-prod"
    ACTIVE_PRIORITY="5"
    INACTIVE_PRIORITY="50"
    HOST_HEADER="api.photlas.jp"
    ;;
  test)
    FUNCTION_NAME="photlas-frontend-fn-test"
    ACTIVE_PRIORITY="6"
    INACTIVE_PRIORITY="51"
    HOST_HEADER="test-api.photlas.jp"
    ;;
  *)
    echo "Usage: $0 <env>" >&2
    echo "  env: prod | test" >&2
    exit 1
    ;;
esac

REGION="ap-northeast-1"
ALB_NAME="photlas-alb"

echo "=== メンテナンスモード状態確認 (${ENV}) ==="
echo "Region:   ${REGION}"
echo "Function: ${FUNCTION_NAME}"

# --- フロント側: CloudFront Function のコメントから判定 ---
FRONT_COMMENT=$(aws cloudfront describe-function \
  --name "$FUNCTION_NAME" \
  --query 'FunctionSummary.FunctionConfig.Comment' \
  --output text 2>/dev/null || echo "unknown")
case "$FRONT_COMMENT" in
  maintenance) FRONT_STATE="ON (maintenance)" ;;
  passthrough) FRONT_STATE="OFF (passthrough)" ;;
  *)           FRONT_STATE="UNKNOWN (comment=${FRONT_COMMENT})" ;;
esac

# --- API 側: ALB ルール優先度から判定 ---
LB_ARN=$(aws elbv2 describe-load-balancers \
  --names "$ALB_NAME" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || echo "")
if [ -n "$LB_ARN" ]; then
  # shellcheck disable=SC2016 # JMESPath で `443` はバックティック必須
  LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn "$LB_ARN" \
    --query 'Listeners[?Port==`443`].ListenerArn | [0]' \
    --output text 2>/dev/null || echo "")
  PRIORITY=$(aws elbv2 describe-rules \
    --listener-arn "$LISTENER_ARN" \
    --query "Rules[?Conditions[?Field=='host-header' && contains(Values, '${HOST_HEADER}')] && Actions[?Type=='fixed-response']].Priority | [0]" \
    --output text 2>/dev/null || echo "unknown")
else
  PRIORITY="unknown"
fi

case "$PRIORITY" in
  "$ACTIVE_PRIORITY")   API_STATE="ON (active priority=${PRIORITY})" ;;
  "$INACTIVE_PRIORITY") API_STATE="OFF (inactive priority=${PRIORITY})" ;;
  *)                    API_STATE="UNKNOWN (priority=${PRIORITY})" ;;
esac

# --- 出力 ---
echo "フロント (CloudFront Function): ${FRONT_STATE}"
echo "API (ALB rule):                  ${API_STATE}"

if [[ "$FRONT_STATE" == ON* ]] && [[ "$API_STATE" == ON* ]]; then
  echo "総合判定: メンテナンスモード ON"
elif [[ "$FRONT_STATE" == OFF* ]] && [[ "$API_STATE" == OFF* ]]; then
  echo "総合判定: メンテナンスモード OFF (通常運用)"
else
  echo "総合判定: 部分状態 (要確認)"
fi
