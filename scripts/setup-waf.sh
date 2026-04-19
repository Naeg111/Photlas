#!/bin/bash
#
# AWS WAF セットアップスクリプト (Issue#94 + Issue#97 マスタースクリプト)
# 既存 ALB (photlas-alb) に Regional WAF をアタッチし、全ルールを投入する
#
# 実行内容:
#   1. WAF ログ保管用 S3 バケット作成（暗号化・PublicBlock・ライフサイクル 90 日）
#   2. Firehose 用 IAM ロール作成
#   3. Kinesis Data Firehose 配信ストリーム作成
#   4. WAFv2 WebACL 作成（全ルール、Count モードで導入）
#        Section 1: Rate Limit Rules (Issue#94)
#          - AuthRateLimit, GeneralRateLimit, StagingLooseLimit
#        Section 2: Managed Rules (Issue#97)
#          - AmazonIpReputationList, KnownBadInputsRuleSet,
#            SQLiRuleSet, CommonRuleSet
#   5. WAF ロギング設定（Authorization ヘッダリダクション）
#   6. WebACL を既存 ALB にアタッチ
#
# 使い方:
#   ./scripts/setup-waf.sh
#
# 冪等性:
#   - S3 バケット / IAM ロール / Firehose / SNS トピック: 既存があればスキップ
#   - WebACL: 既存があればルール定義を「現在のスクリプト定義」で上書き更新
#   - WebACL の ALB 関連付け: 既に同じ WebACL がアタッチ済みならスキップ、別の WebACL が
#     アタッチされていればエラー終了
#
# 再実行時の注意:
#   本スクリプトは WebACL の全ルールを Count モードで書き込むため、
#   ./scripts/switch-waf-block-mode.sh や ./scripts/waf-block-switch.sh で
#   Block モードに切替後に本スクリプトを再実行すると、WebACL は Count モードに
#   差し戻される。これは意図的な動作（緊急時の簡易ロールバックとして機能する）。
#   ただし CloudWatch アラーム側は BlockedRequests 用のまま残るため、
#   完全にロールバックする場合は setup-waf-alarms.sh / setup-waf-managed-rules-alarm.sh も
#   再実行すること。
#
# 関連ドキュメント:
#   documents/04_Issues/Issue#94_フェーズ1_手順書.md
#   documents/04_Issues/Issue#97.md
#

set -euo pipefail

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------

AWS_REGION="ap-northeast-1"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

ALB_NAME="photlas-alb"
WAF_LOGS_BUCKET="photlas-waf-logs-${AWS_ACCOUNT_ID}"
FIREHOSE_NAME="aws-waf-logs-photlas"
FIREHOSE_ROLE_NAME="photlas-waf-firehose-role"
WEBACL_NAME="photlas-waf-main"

# 共通タグ（既存 EC2 の Environment 値に合わせてフル綴り）
# 適用するリソースタグ:
#   Project=Photlas
#   Environment=production   (StagingLooseLimit 系リソースは Environment=staging)
#   ManagedBy=Issue-94       (AWS タグ値に '#' は使えないためハイフン表記)
#   CostCenter=waf
TAG_PROJECT="Photlas"
TAG_ENVIRONMENT="production"
TAG_MANAGED_BY="Issue-94"
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

# -----------------------------------------------------------------------------
# 事前チェック
# -----------------------------------------------------------------------------

section "Pre-flight check"

log "AWS Account: $AWS_ACCOUNT_ID"
log "Region: $AWS_REGION"

ALB_ARN="$(aws elbv2 describe-load-balancers \
  --names "$ALB_NAME" \
  --region "$AWS_REGION" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)"

if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
  echo "ERROR: ALB '$ALB_NAME' not found in region $AWS_REGION"
  exit 1
fi
log "ALB ARN: $ALB_ARN"

# -----------------------------------------------------------------------------
# 1. S3 バケット
# -----------------------------------------------------------------------------

section "Step 1: S3 bucket for WAF logs"

if aws s3api head-bucket --bucket "$WAF_LOGS_BUCKET" 2>/dev/null; then
  log "Bucket $WAF_LOGS_BUCKET already exists, skipping creation"
else
  log "Creating bucket: $WAF_LOGS_BUCKET"
  aws s3api create-bucket \
    --bucket "$WAF_LOGS_BUCKET" \
    --region "$AWS_REGION" \
    --create-bucket-configuration "LocationConstraint=$AWS_REGION"
fi

log "Applying public access block"
aws s3api put-public-access-block \
  --bucket "$WAF_LOGS_BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

log "Applying SSE-S3 encryption"
aws s3api put-bucket-encryption \
  --bucket "$WAF_LOGS_BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

log "Applying lifecycle policy (90-day expiration)"
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$WAF_LOGS_BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "delete-old-waf-logs",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "Expiration": {"Days": 90}
    }]
  }'

log "Applying tags"
cat > "$TMP_DIR/bucket-tags.json" <<EOF
{
  "TagSet": [
    {"Key": "Project", "Value": "${TAG_PROJECT}"},
    {"Key": "Environment", "Value": "${TAG_ENVIRONMENT}"},
    {"Key": "ManagedBy", "Value": "${TAG_MANAGED_BY}"},
    {"Key": "CostCenter", "Value": "${TAG_COST_CENTER}"}
  ]
}
EOF
aws s3api put-bucket-tagging \
  --bucket "$WAF_LOGS_BUCKET" \
  --tagging "file://$TMP_DIR/bucket-tags.json"

# -----------------------------------------------------------------------------
# 2. IAM ロール (Firehose 用)
# -----------------------------------------------------------------------------

section "Step 2: IAM role for Firehose"

if aws iam get-role --role-name "$FIREHOSE_ROLE_NAME" >/dev/null 2>&1; then
  log "Role $FIREHOSE_ROLE_NAME already exists, skipping creation"
else
  log "Creating role: $FIREHOSE_ROLE_NAME"
  cat > "$TMP_DIR/firehose-trust-policy.json" <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "firehose.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF
  aws iam create-role \
    --role-name "$FIREHOSE_ROLE_NAME" \
    --assume-role-policy-document "file://$TMP_DIR/firehose-trust-policy.json" \
    --description "Firehose role for AWS WAF logs delivery to S3 - Issue#94" \
    --tags \
      "Key=Project,Value=${TAG_PROJECT}" \
      "Key=Environment,Value=${TAG_ENVIRONMENT}" \
      "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
      "Key=CostCenter,Value=${TAG_COST_CENTER}"
fi

log "Attaching inline policy for S3 access"
cat > "$TMP_DIR/firehose-s3-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject"
    ],
    "Resource": [
      "arn:aws:s3:::${WAF_LOGS_BUCKET}",
      "arn:aws:s3:::${WAF_LOGS_BUCKET}/*"
    ]
  }]
}
EOF
aws iam put-role-policy \
  --role-name "$FIREHOSE_ROLE_NAME" \
  --policy-name "photlas-waf-firehose-s3-access" \
  --policy-document "file://$TMP_DIR/firehose-s3-policy.json"

FIREHOSE_ROLE_ARN="$(aws iam get-role \
  --role-name "$FIREHOSE_ROLE_NAME" \
  --query 'Role.Arn' --output text)"
log "Firehose role ARN: $FIREHOSE_ROLE_ARN"

# IAM ロールの伝播を待つ（作成直後は Firehose からアクセスできないことがある）
log "Waiting 10 seconds for IAM role propagation..."
sleep 10

# -----------------------------------------------------------------------------
# 3. Kinesis Data Firehose
# -----------------------------------------------------------------------------

section "Step 3: Kinesis Data Firehose delivery stream"

if aws firehose describe-delivery-stream \
  --delivery-stream-name "$FIREHOSE_NAME" \
  --region "$AWS_REGION" >/dev/null 2>&1; then
  log "Firehose $FIREHOSE_NAME already exists, skipping creation"
else
  log "Creating Firehose delivery stream: $FIREHOSE_NAME"
  aws firehose create-delivery-stream \
    --delivery-stream-name "$FIREHOSE_NAME" \
    --delivery-stream-type DirectPut \
    --region "$AWS_REGION" \
    --tags \
      "Key=Project,Value=${TAG_PROJECT}" \
      "Key=Environment,Value=${TAG_ENVIRONMENT}" \
      "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
      "Key=CostCenter,Value=${TAG_COST_CENTER}" \
    --extended-s3-destination-configuration "{
      \"RoleARN\": \"${FIREHOSE_ROLE_ARN}\",
      \"BucketARN\": \"arn:aws:s3:::${WAF_LOGS_BUCKET}\",
      \"Prefix\": \"waf-logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/\",
      \"ErrorOutputPrefix\": \"waf-logs-errors/\",
      \"BufferingHints\": {\"SizeInMBs\": 5, \"IntervalInSeconds\": 300},
      \"CompressionFormat\": \"GZIP\",
      \"EncryptionConfiguration\": {\"NoEncryptionConfig\": \"NoEncryption\"}
    }"

  log "Waiting for Firehose stream to become ACTIVE..."
  while true; do
    STATUS="$(aws firehose describe-delivery-stream \
      --delivery-stream-name "$FIREHOSE_NAME" \
      --region "$AWS_REGION" \
      --query 'DeliveryStreamDescription.DeliveryStreamStatus' \
      --output text)"
    log "  Firehose status: $STATUS"
    [ "$STATUS" = "ACTIVE" ] && break
    sleep 5
  done
fi

FIREHOSE_ARN="$(aws firehose describe-delivery-stream \
  --delivery-stream-name "$FIREHOSE_NAME" \
  --region "$AWS_REGION" \
  --query 'DeliveryStreamDescription.DeliveryStreamARN' \
  --output text)"
log "Firehose ARN: $FIREHOSE_ARN"

# -----------------------------------------------------------------------------
# 4. WAFv2 WebACL
# -----------------------------------------------------------------------------

section "Step 4: WAFv2 WebACL"

# ============================================================
# Section 1: Rate Limit Rules (Issue#94)
# ============================================================
#
# ByteMatchStatement.SearchString は WAFv2 API では blob 型のため、
# AWS CLI v2 に JSON で渡す際は Base64 エンコードが必須。
# 生文字列 → Base64 対応表:
#   api.photlas.jp       → YXBpLnBob3RsYXMuanA=
#   /api/v1/auth/        → L2FwaS92MS9hdXRoLw==
#   test-api.photlas.jp  → dGVzdC1hcGkucGhvdGxhcy5qcA==
cat > "$TMP_DIR/rate-limit-rules.json" <<'EOF'
[
  {
    "Name": "AuthRateLimit",
    "Priority": 10,
    "Action": {"Count": {}},
    "Statement": {
      "RateBasedStatement": {
        "Limit": 100,
        "EvaluationWindowSec": 300,
        "AggregateKeyType": "FORWARDED_IP",
        "ForwardedIPConfig": {
          "HeaderName": "X-Forwarded-For",
          "FallbackBehavior": "NO_MATCH"
        },
        "ScopeDownStatement": {
          "AndStatement": {
            "Statements": [
              {
                "ByteMatchStatement": {
                  "SearchString": "YXBpLnBob3RsYXMuanA=",
                  "FieldToMatch": {"SingleHeader": {"Name": "host"}},
                  "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
                  "PositionalConstraint": "EXACTLY"
                }
              },
              {
                "ByteMatchStatement": {
                  "SearchString": "L2FwaS92MS9hdXRoLw==",
                  "FieldToMatch": {"UriPath": {}},
                  "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
                  "PositionalConstraint": "STARTS_WITH"
                }
              }
            ]
          }
        }
      }
    },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "AuthRateLimit"
    }
  },
  {
    "Name": "GeneralRateLimit",
    "Priority": 20,
    "Action": {"Count": {}},
    "Statement": {
      "RateBasedStatement": {
        "Limit": 2000,
        "EvaluationWindowSec": 300,
        "AggregateKeyType": "FORWARDED_IP",
        "ForwardedIPConfig": {
          "HeaderName": "X-Forwarded-For",
          "FallbackBehavior": "NO_MATCH"
        },
        "ScopeDownStatement": {
          "ByteMatchStatement": {
            "SearchString": "YXBpLnBob3RsYXMuanA=",
            "FieldToMatch": {"SingleHeader": {"Name": "host"}},
            "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
            "PositionalConstraint": "EXACTLY"
          }
        }
      }
    },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "GeneralRateLimit"
    }
  },
  {
    "Name": "StagingLooseLimit",
    "Priority": 30,
    "Action": {"Count": {}},
    "Statement": {
      "RateBasedStatement": {
        "Limit": 5000,
        "EvaluationWindowSec": 300,
        "AggregateKeyType": "FORWARDED_IP",
        "ForwardedIPConfig": {
          "HeaderName": "X-Forwarded-For",
          "FallbackBehavior": "NO_MATCH"
        },
        "ScopeDownStatement": {
          "ByteMatchStatement": {
            "SearchString": "dGVzdC1hcGkucGhvdGxhcy5qcA==",
            "FieldToMatch": {"SingleHeader": {"Name": "host"}},
            "TextTransformations": [{"Priority": 0, "Type": "LOWERCASE"}],
            "PositionalConstraint": "EXACTLY"
          }
        }
      }
    },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "StagingLooseLimit"
    }
  }
]
EOF

# ============================================================
# Section 2: Managed Rules (Issue#97)
# ============================================================
#
# 4 AWS マネージドルール（優先度 §3.2: cheap -> heavy）:
#
#   1. AmazonIpReputationList, "Priority": 100 (25 WCU)
#      既知の悪性 IP を低コストで遮断
#   2. KnownBadInputsRuleSet, "Priority": 110 (200 WCU)
#      既知の攻撃パターン / スキャナー検知
#   3. SQLiRuleSet, "Priority": 120 (200 WCU)
#      SQL インジェクション専用検知
#   4. CommonRuleSet, "Priority": 130 (700 WCU)
#      OWASP Top 10 汎用防御
#
# 各マネージドルールは:
#   - OverrideAction: Count (初期状態 §3.3 - Count モード中は全サブルール Count 動作)
#   - ScopeDownStatement で Host=api.photlas.jp に限定 (§3.8 Plan H)
#   - 全サブルール(計 42)を RuleActionOverrides で
#     Block + HTTP 429 + RateLimitExceeded body + Retry-After: 60 に統一 (§3.7)
#     (Count モード中は待機、OverrideAction 削除時にアクティベート)
#   - バージョンは describe-managed-rule-group で動的取得 (§3.9, §3.11)

section "Section 2: Building managed rules (Issue#97)"

# マネージドルールグループの CurrentDefaultVersion を取得する。
# 一部のルールグループでは CurrentDefaultVersion が null の場合があるため、
# その際は list-available-managed-rule-group-versions の最新を採用する。
fetch_managed_rule_version() {
  local group_name="$1"
  local version
  version="$(aws wafv2 describe-managed-rule-group \
    --vendor-name AWS \
    --name "$group_name" \
    --scope REGIONAL \
    --region "$AWS_REGION" \
    --query 'CurrentDefaultVersion' --output text 2>/dev/null || true)"
  if [ -z "$version" ] || [ "$version" = "None" ]; then
    version="$(aws wafv2 list-available-managed-rule-group-versions \
      --vendor-name AWS \
      --name "$group_name" \
      --scope REGIONAL \
      --region "$AWS_REGION" \
      --query 'Versions[0].Name' --output text)"
  fi
  echo "$version"
}

# サブルール名一覧を JSON 配列で返す (describe-managed-rule-group)
fetch_managed_rule_subrules() {
  local group_name="$1"
  local version="$2"
  if [ -n "$version" ] && [ "$version" != "None" ]; then
    aws wafv2 describe-managed-rule-group \
      --vendor-name AWS \
      --name "$group_name" \
      --version-name "$version" \
      --scope REGIONAL \
      --region "$AWS_REGION" \
      --query 'Rules[].Name' --output json
  else
    aws wafv2 describe-managed-rule-group \
      --vendor-name AWS \
      --name "$group_name" \
      --scope REGIONAL \
      --region "$AWS_REGION" \
      --query 'Rules[].Name' --output json
  fi
}

# サブルール名配列から RuleActionOverrides JSON 配列を生成。
# 各サブルールに対して Block + HTTP 429 + RateLimitExceeded body +
# "Retry-After": 60 を統一適用する (§3.7)。
build_rule_action_overrides() {
  local subrules_json="$1"
  echo "$subrules_json" | jq '[ .[] | {
    "Name": .,
    "ActionToUse": {
      "Block": {
        "CustomResponse": {
          "ResponseCode": 429,
          "CustomResponseBodyKey": "RateLimitExceeded",
          "ResponseHeaders": [ { "Name": "Retry-After", "Value": "60" } ]
        }
      }
    }
  } ]'
}

# マネージドルール 1 件を JSON オブジェクトとして出力。
#   $1 rule_name     WebACL 内の表示名（CloudWatch Rule dim 値と一致）
#   $2 group_name    AWS マネージドルールグループ名
#   $3 priority      優先度（整数）
build_managed_rule() {
  local rule_name="$1"
  local group_name="$2"
  local priority="$3"
  local version
  local subrules
  local overrides
  version="$(fetch_managed_rule_version "$group_name")"
  subrules="$(fetch_managed_rule_subrules "$group_name" "$version")"
  overrides="$(build_rule_action_overrides "$subrules")"
  log "  $rule_name (priority $priority): version=$version, sub-rules=$(echo "$subrules" | jq 'length')"
  jq -n \
    --arg rule_name "$rule_name" \
    --arg group_name "$group_name" \
    --argjson priority "$priority" \
    --arg version "$version" \
    --argjson overrides "$overrides" '{
      "Name": $rule_name,
      "Priority": $priority,
      "OverrideAction": { "Count": {} },
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": $group_name,
          "Version": $version,
          "RuleActionOverrides": $overrides,
          "ScopeDownStatement": {
            "ByteMatchStatement": {
              "SearchString": "YXBpLnBob3RsYXMuanA=",
              "FieldToMatch": { "SingleHeader": { "Name": "host" } },
              "TextTransformations": [ { "Priority": 0, "Type": "LOWERCASE" } ],
              "PositionalConstraint": "EXACTLY"
            }
          }
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": $rule_name
      }
    }'
}

log "Building managed rules (describe-managed-rule-group for each)..."

IP_REP_RULE_JSON="$(build_managed_rule \
  "AmazonIpReputationList" \
  "AWSManagedRulesAmazonIpReputationList" \
  100)"

KBI_RULE_JSON="$(build_managed_rule \
  "KnownBadInputsRuleSet" \
  "AWSManagedRulesKnownBadInputsRuleSet" \
  110)"

SQLI_RULE_JSON="$(build_managed_rule \
  "SQLiRuleSet" \
  "AWSManagedRulesSQLiRuleSet" \
  120)"

COMMON_RULE_JSON="$(build_managed_rule \
  "CommonRuleSet" \
  "AWSManagedRulesCommonRuleSet" \
  130)"

# Section 1 + Section 2 を 1 つのルール配列にマージ
# 先頭が Section 1 (Priority 10-30)、続いて Section 2 (Priority 100-130)
jq -n \
  --slurpfile section1 "$TMP_DIR/rate-limit-rules.json" \
  --argjson ip_rep  "$IP_REP_RULE_JSON" \
  --argjson kbi     "$KBI_RULE_JSON" \
  --argjson sqli    "$SQLI_RULE_JSON" \
  --argjson common  "$COMMON_RULE_JSON" \
  '$section1[0] + [$ip_rep, $kbi, $sqli, $common]' \
  > "$TMP_DIR/webacl-rules.json"

log "Combined rule set written: $(jq 'length' "$TMP_DIR/webacl-rules.json") rules total"

# WebACL の CustomResponseBodies（Block モード切替後に使用）
# Key "RateLimitExceeded" を switch-waf-block-mode.sh / waf-block-switch.sh から
# および Section 2 マネージドルールの RuleActionOverrides から
# CustomResponseBodyKey として参照する。
#
# 生の JSON ボディ (下の heredoc では JSON 文字列内に埋め込むためクォートがエスケープされる):
#   {"error":"Too Many Requests","code":"RATE_LIMIT_EXCEEDED","message":"Too many requests. Please retry after some time.","retryAfter":60}
cat > "$TMP_DIR/custom-response-bodies.json" <<'EOF'
{
  "RateLimitExceeded": {
    "ContentType": "APPLICATION_JSON",
    "Content": "{\"error\":\"Too Many Requests\",\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please retry after some time.\",\"retryAfter\":60}"
  }
}
EOF

# 既存 WebACL 確認
EXISTING_WEBACL_ID="$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].Id | [0]" \
  --output text)"

if [ -n "$EXISTING_WEBACL_ID" ] && [ "$EXISTING_WEBACL_ID" != "None" ]; then
  log "WebACL $WEBACL_NAME already exists (ID: $EXISTING_WEBACL_ID)"
  log "Updating rules to current definition..."
  LOCK_TOKEN="$(aws wafv2 get-web-acl \
    --name "$WEBACL_NAME" \
    --scope REGIONAL \
    --id "$EXISTING_WEBACL_ID" \
    --region "$AWS_REGION" \
    --query 'LockToken' --output text)"
  aws wafv2 update-web-acl \
    --name "$WEBACL_NAME" \
    --scope REGIONAL \
    --id "$EXISTING_WEBACL_ID" \
    --lock-token "$LOCK_TOKEN" \
    --region "$AWS_REGION" \
    --default-action '{"Allow": {}}' \
    --rules "file://$TMP_DIR/webacl-rules.json" \
    --custom-response-bodies "file://$TMP_DIR/custom-response-bodies.json" \
    --visibility-config '{
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "photlas-waf-main"
    }'
else
  log "Creating WebACL: $WEBACL_NAME"
  aws wafv2 create-web-acl \
    --name "$WEBACL_NAME" \
    --scope REGIONAL \
    --region "$AWS_REGION" \
    --default-action '{"Allow": {}}' \
    --rules "file://$TMP_DIR/webacl-rules.json" \
    --custom-response-bodies "file://$TMP_DIR/custom-response-bodies.json" \
    --visibility-config '{
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "photlas-waf-main"
    }' \
    --description "Photlas main WAF with rate limiting rules - Issue#94" \
    --tags \
      "Key=Project,Value=${TAG_PROJECT}" \
      "Key=Environment,Value=${TAG_ENVIRONMENT}" \
      "Key=ManagedBy,Value=${TAG_MANAGED_BY}" \
      "Key=CostCenter,Value=${TAG_COST_CENTER}"
fi

WEBACL_ID="$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].Id | [0]" \
  --output text)"
WEBACL_ARN="$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEBACL_NAME}'].ARN | [0]" \
  --output text)"
log "WebACL ID: $WEBACL_ID"
log "WebACL ARN: $WEBACL_ARN"

# -----------------------------------------------------------------------------
# 5. WAF ロギング設定
# -----------------------------------------------------------------------------

section "Step 5: WAF logging configuration"

log "Applying logging configuration with Authorization header redaction"
cat > "$TMP_DIR/waf-logging-config.json" <<EOF
{
  "ResourceArn": "${WEBACL_ARN}",
  "LogDestinationConfigs": ["${FIREHOSE_ARN}"],
  "RedactedFields": [
    {"SingleHeader": {"Name": "authorization"}}
  ]
}
EOF
aws wafv2 put-logging-configuration \
  --region "$AWS_REGION" \
  --logging-configuration "file://$TMP_DIR/waf-logging-config.json"

# -----------------------------------------------------------------------------
# 6. ALB に WebACL をアタッチ
# -----------------------------------------------------------------------------

section "Step 6: Associate WebACL with ALB"

CURRENT_ATTACHED="$(aws wafv2 get-web-acl-for-resource \
  --resource-arn "$ALB_ARN" \
  --region "$AWS_REGION" \
  --query 'WebACL.ARN' \
  --output text 2>/dev/null || echo "")"

if [ "$CURRENT_ATTACHED" = "$WEBACL_ARN" ]; then
  log "WebACL already associated with ALB, skipping"
elif [ -n "$CURRENT_ATTACHED" ] && [ "$CURRENT_ATTACHED" != "None" ]; then
  echo "ERROR: A different WebACL is already attached to ALB: $CURRENT_ATTACHED"
  echo "Please disassociate it manually before running this script."
  exit 1
else
  log "Associating WebACL with ALB"
  aws wafv2 associate-web-acl \
    --web-acl-arn "$WEBACL_ARN" \
    --resource-arn "$ALB_ARN" \
    --region "$AWS_REGION"
fi

# -----------------------------------------------------------------------------
# 完了
# -----------------------------------------------------------------------------

section "Setup complete"

cat <<EOF

WAF setup completed successfully.

  S3 bucket:      s3://${WAF_LOGS_BUCKET}
  Firehose:       ${FIREHOSE_NAME}
  WebACL:         ${WEBACL_NAME} (ID: ${WEBACL_ID})
  ALB:            ${ALB_NAME}
  Mode:           Count (all rules)

Next steps:
  1. Run: ./scripts/setup-waf-alarms.sh
  2. Verify API still responds normally:
       curl -sI https://api.photlas.jp/api/v1/health
       curl -sI https://test-api.photlas.jp/api/v1/health
  3. Observe for 1-2 weeks in Count mode
  4. Switch to Block mode: ./scripts/switch-waf-block-mode.sh

EOF
