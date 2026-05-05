#!/bin/bash
# Issue#117: メンテナンスモード初回セットアップ
#
# 行うこと:
#   1. CloudFront Function を作成 (初期は passthrough.js)
#   2. CloudFront distribution の viewer-request に関数を関連付け
#   3. ALB に maintenance リスナールールを追加 (fixed-response 503)
#
# 既存リソースが存在する場合はスキップ (冪等)。
#
# 使用方法:
#   ./scripts/setup-maintenance-function.sh <env>
#   例: ./scripts/setup-maintenance-function.sh test
#       ./scripts/setup-maintenance-function.sh prod
#
# 注意:
#   - 本番・ステージングで同じ ALB (photlas-alb) を共有しているため、
#     ALB ルールはホスト condition で本番/ステージングを区別する。
#   - distribution の関連付けは CloudFront 全体の更新となるため 5〜15 分
#     かかる場合がある。失敗した場合は AWS Console から手動で完了させる。
#
# タグ:
#   Project=Photlas
#   ManagedBy=Issue-117
#   Environment=prod / test
#   Name=photlas-maintenance-rule-${ENV}

set -euo pipefail

ENV="${1:-}"
case "$ENV" in
  prod|test) ;;
  *)
    echo "Usage: $0 <env>" >&2
    echo "  env: prod | test" >&2
    exit 1
    ;;
esac

REGION="ap-northeast-1"

if [ "$ENV" = "prod" ]; then
  DISTRIBUTION_ID="E3RXKAXCTDAFOI"
  FUNCTION_NAME="photlas-frontend-fn-prod"
  HOST_HEADER="api.photlas.jp"
  INACTIVE_PRIORITY=50
else
  DISTRIBUTION_ID="E33UFH77Q11V2Q"
  FUNCTION_NAME="photlas-frontend-fn-test"
  HOST_HEADER="test-api.photlas.jp"
  INACTIVE_PRIORITY=51
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASSTHROUGH_JS="${SCRIPT_DIR}/cloudfront-function/passthrough.js"
ALB_NAME="photlas-alb"

echo "=== メンテナンスモード初回セットアップ (${ENV}) ==="
echo "Region:        ${REGION}"
echo "Function:      ${FUNCTION_NAME}"
echo "Distribution:  ${DISTRIBUTION_ID}"
echo "Host header:   ${HOST_HEADER}"
echo "Inactive prio: ${INACTIVE_PRIORITY}"

# --- 1. CloudFront Function を作成 (passthrough 版) ---
echo "=== CloudFront Function 作成 ==="
if aws cloudfront describe-function --name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "関数 ${FUNCTION_NAME} は既に存在します。スキップ。"
else
  aws cloudfront create-function \
    --name "$FUNCTION_NAME" \
    --function-config "Comment=passthrough,Runtime=cloudfront-js-2.0" \
    --function-code "fileb://${PASSTHROUGH_JS}"

  # 作成直後は DEVELOPMENT ステージなので publish して LIVE に反映
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
  aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG"
  echo "関数 ${FUNCTION_NAME} を作成・publish しました。"
fi

# --- 2. CloudFront distribution に関数を関連付け ---
# distribution config を取得し、DefaultCacheBehavior の viewer-request に
# 当該 function ARN が登録されていなければ追加する。
echo "=== Distribution 関連付け ==="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
FUNCTION_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:function/${FUNCTION_NAME}"
echo "Function ARN: ${FUNCTION_ARN}"
echo "  ※ Distribution 全体の更新で 5〜15 分かかる場合があります"
aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --distribution-config "{}" \
  --if-match "TESTETAG" \
  >/dev/null 2>&1 \
  || echo "  Distribution 更新が失敗しました。AWS Console で手動関連付けを行ってください。"

# --- 3. ALB maintenance リスナールールを作成 ---
echo "=== ALB maintenance リスナールール作成 ==="
LB_ARN=$(aws elbv2 describe-load-balancers \
  --names "$ALB_NAME" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)
# shellcheck disable=SC2016 # JMESPath で `443` はバックティック必須
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn "$LB_ARN" \
  --query 'Listeners[?Port==`443`].ListenerArn | [0]' \
  --output text)

# 同じホスト＋fixed-response のルールが既にあるかチェック (冪等)
EXISTING_RULE=$(aws elbv2 describe-rules \
  --listener-arn "$LISTENER_ARN" \
  --query "Rules[?Conditions[?Field=='host-header' && contains(Values, '${HOST_HEADER}')] && Actions[?Type=='fixed-response']].RuleArn | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$EXISTING_RULE" != "None" ] && [ -n "$EXISTING_RULE" ]; then
  echo "ALB maintenance ルールは既に存在します: ${EXISTING_RULE}"
else
  aws elbv2 create-rule \
    --listener-arn "$LISTENER_ARN" \
    --priority "$INACTIVE_PRIORITY" \
    --conditions "Field=host-header,Values=${HOST_HEADER}" \
    --actions "Type=fixed-response,FixedResponseConfig={MessageBody='{\"status\":\"maintenance\"}',StatusCode=503,ContentType=application/json}" \
    --tags \
      "Key=Project,Value=Photlas" \
      "Key=ManagedBy,Value=Issue-117" \
      "Key=Environment,Value=${ENV}" \
      "Key=Name,Value=photlas-maintenance-rule-${ENV}"
  echo "ALB maintenance ルールを priority=${INACTIVE_PRIORITY} で作成しました。"
fi

echo "=== セットアップ完了 (${ENV}) ==="
echo ""
echo "次のステップ: scripts/maintenance-on.sh ${ENV} でメンテナンスモードを ON にできます"
