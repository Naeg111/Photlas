#!/bin/bash
# Issue#117: メンテナンスモード OFF 切替
#
# OFF 時の順序: API → フロント
#   フロントが復活した瞬間に API に到達できる状態にするため、API を先に
#   通常運用に戻してからフロントを passthrough に戻す。
#
# 使用方法:
#   ./scripts/maintenance-off.sh <env>
#   例: ./scripts/maintenance-off.sh test
#       ./scripts/maintenance-off.sh prod

set -euo pipefail

ENV="${1:-}"
case "$ENV" in
  prod)
    FUNCTION_NAME="photlas-frontend-fn-prod"
    INACTIVE_PRIORITY=50
    HOST_HEADER="api.photlas.jp"
    FRONT_HOST="photlas.jp"
    API_HOST="api.photlas.jp"
    ;;
  test)
    FUNCTION_NAME="photlas-frontend-fn-test"
    INACTIVE_PRIORITY=51
    HOST_HEADER="test-api.photlas.jp"
    FRONT_HOST="test.photlas.jp"
    API_HOST="test-api.photlas.jp"
    ;;
  *)
    echo "Usage: $0 <env>" >&2
    echo "  env: prod | test" >&2
    exit 1
    ;;
esac

REGION="ap-northeast-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASSTHROUGH_JS="${SCRIPT_DIR}/cloudfront-function/passthrough.js"
ALB_NAME="photlas-alb"
PROPAGATION_WAIT_SEC=30

echo "=== メンテナンスモード OFF (${ENV}) ==="
echo "Region:   ${REGION}"
echo "Function: ${FUNCTION_NAME}"
echo "Priority: ${INACTIVE_PRIORITY} (inactive)"

# --- 1. API 側: ALB のメンテナンスルールを inactive 優先度に戻す ---
echo "=== ALB メンテナンスルール優先度を inactive=${INACTIVE_PRIORITY} に戻し (API 側) ==="
LB_ARN=$(aws elbv2 describe-load-balancers \
  --names "$ALB_NAME" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)
# shellcheck disable=SC2016 # JMESPath で `443` はバックティック必須
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn "$LB_ARN" \
  --query 'Listeners[?Port==`443`].ListenerArn | [0]' \
  --output text)
RULE_ARN=$(aws elbv2 describe-rules \
  --listener-arn "$LISTENER_ARN" \
  --query "Rules[?Conditions[?Field=='host-header' && contains(Values, '${HOST_HEADER}')] && Actions[?Type=='fixed-response']].RuleArn | [0]" \
  --output text)
aws elbv2 set-rule-priorities \
  --rule-priorities "RuleArn=${RULE_ARN},Priority=${INACTIVE_PRIORITY}"

# --- 2. フロント側: CloudFront Function を passthrough.js に戻す + publish ---
echo "=== CloudFront Function を passthrough に戻し (フロント側) ==="
ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
aws cloudfront update-function \
  --name "$FUNCTION_NAME" \
  --function-config "Comment=passthrough,Runtime=cloudfront-js-2.0" \
  --function-code "fileb://${PASSTHROUGH_JS}" \
  --if-match "$ETAG"

ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG"

# --- 3. 確認 ---
echo "=== CloudFront Function publish 伝播待機 (${PROPAGATION_WAIT_SEC} 秒) ==="
sleep "$PROPAGATION_WAIT_SEC"

echo "--- フロント (https://${FRONT_HOST}/) → 200 を期待 ---"
curl -I "https://${FRONT_HOST}/" || true
echo "--- API (https://${API_HOST}/health) → 200 を期待 ---"
curl -I "https://${API_HOST}/health" || true

echo "=== メンテナンスモード OFF 完了 (${ENV}) ==="
