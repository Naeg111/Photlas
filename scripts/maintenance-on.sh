#!/bin/bash
# Issue#117: メンテナンスモード ON 切替
#
# ON 時の順序: フロント → API
#   ユーザーが「フロントは生きてるのに API 失敗」状態を見ないようにするため、
#   フロントを先に 503 に切り替えてから API を 503 にする。
#
# 使用方法:
#   ./scripts/maintenance-on.sh <env>
#   例: ./scripts/maintenance-on.sh test
#       ./scripts/maintenance-on.sh prod

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/maintenance-common.sh disable=SC1091
. "${SCRIPT_DIR}/lib/maintenance-common.sh"

ENV="${1:-}"
case "$ENV" in
  prod)
    FUNCTION_NAME="photlas-frontend-fn-prod"
    ACTIVE_PRIORITY=5
    HOST_HEADER="api.photlas.jp"
    FRONT_HOST="photlas.jp"
    API_HOST="api.photlas.jp"
    ;;
  test)
    FUNCTION_NAME="photlas-frontend-fn-test"
    ACTIVE_PRIORITY=6
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

MAINTENANCE_JS="${SCRIPT_DIR}/cloudfront-function/maintenance.js"

echo "=== メンテナンスモード ON (${ENV}) ==="
echo "Region:   ${REGION}"
echo "Function: ${FUNCTION_NAME}"
echo "Priority: ${ACTIVE_PRIORITY} (active)"

# --- 1. メンテナンス HTML を関数コードに埋め込み ---
echo "=== HTML を CloudFront Function コードに埋め込み ==="
bash "${SCRIPT_DIR}/build-maintenance-function.sh"

# --- 2. フロント側: CloudFront Function を maintenance 版に更新 + publish ---
echo "=== CloudFront Function 更新 (フロント側) ==="
ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
aws cloudfront update-function \
  --name "$FUNCTION_NAME" \
  --function-config "Comment=maintenance,Runtime=cloudfront-js-2.0" \
  --function-code "fileb://${MAINTENANCE_JS}" \
  --if-match "$ETAG"

ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG"

# --- 3. API 側: ALB のメンテナンスルールを active 優先度に変更 ---
echo "=== ALB メンテナンスルール優先度を active=${ACTIVE_PRIORITY} に変更 (API 側) ==="
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
  --rule-priorities "RuleArn=${RULE_ARN},Priority=${ACTIVE_PRIORITY}"

# --- 4. 確認 ---
echo "=== CloudFront Function publish 伝播待機 (${PROPAGATION_WAIT_SEC} 秒) ==="
sleep "$PROPAGATION_WAIT_SEC"

echo "--- フロント (https://${FRONT_HOST}/) → 503 を期待 ---"
curl -I "https://${FRONT_HOST}/" || true
echo "--- API (https://${API_HOST}/health) → 503 を期待 ---"
curl -I "https://${API_HOST}/health" || true

echo "=== メンテナンスモード ON 完了 (${ENV}) ==="
