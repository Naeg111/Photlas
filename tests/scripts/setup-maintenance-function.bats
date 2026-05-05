#!/usr/bin/env bats
#
# Issue#117: scripts/setup-maintenance-function.sh の動作を検証する。
# このスクリプトは初回セットアップ専用で、CloudFront Function を作成し
# distribution に関連付け、ALB に maintenance リスナールールを追加する。
#
# Source of truth: documents/04_Issues/Issue#117.md §4.5

load helpers

SCRIPT="$REPO_ROOT/scripts/setup-maintenance-function.sh"

@test "setup-maintenance-function.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-maintenance-function.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-maintenance-function.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-maintenance-function.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-maintenance-function.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- 環境引数のサポート (prod / test) ----------------------------------------

@test "setup-maintenance-function.sh: requires environment argument (prod or test)" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "setup-maintenance-function.sh: rejects invalid environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" staging
  [ "$status" -ne 0 ]
}

@test "setup-maintenance-function.sh: accepts prod" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" prod
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

@test "setup-maintenance-function.sh: accepts test" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" test
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

# --- リソース命名 ------------------------------------------------------------

@test "setup-maintenance-function.sh: defines prod CloudFront Function name" {
  assert_contains "$SCRIPT" 'photlas-frontend-fn-prod'
}

@test "setup-maintenance-function.sh: defines test CloudFront Function name" {
  assert_contains "$SCRIPT" 'photlas-frontend-fn-test'
}

@test "setup-maintenance-function.sh: references prod distribution ID" {
  assert_contains "$SCRIPT" 'E3RXKAXCTDAFOI'
}

@test "setup-maintenance-function.sh: references test distribution ID" {
  assert_contains "$SCRIPT" 'E33UFH77Q11V2Q'
}

# --- CloudFront Function 作成 ------------------------------------------------

@test "setup-maintenance-function.sh: calls cloudfront create-function" {
  assert_contains "$SCRIPT" 'aws cloudfront create-function'
}

@test "setup-maintenance-function.sh: initial deploy uses passthrough.js" {
  assert_contains "$SCRIPT" 'passthrough.js'
}

@test "setup-maintenance-function.sh: associates function with distribution" {
  assert_contains "$SCRIPT" 'aws cloudfront update-distribution'
}

# --- ALB maintenance リスナールール ------------------------------------------

@test "setup-maintenance-function.sh: creates ALB rule with fixed-response 503" {
  assert_contains "$SCRIPT" 'aws elbv2 create-rule'
  assert_contains "$SCRIPT" 'fixed-response'
  assert_contains "$SCRIPT" '503'
}

@test "setup-maintenance-function.sh: prod ALB rule uses host=api.photlas.jp" {
  assert_contains "$SCRIPT" 'api.photlas.jp'
}

@test "setup-maintenance-function.sh: test ALB rule uses host=test-api.photlas.jp" {
  assert_contains "$SCRIPT" 'test-api.photlas.jp'
}

@test "setup-maintenance-function.sh: prod inactive priority is 50" {
  assert_matches "$SCRIPT" '\b50\b'
}

@test "setup-maintenance-function.sh: test inactive priority is 51" {
  assert_matches "$SCRIPT" '\b51\b'
}

# --- リソースタグ ------------------------------------------------------------

@test "setup-maintenance-function.sh: tags resources with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project=Photlas'
}

@test "setup-maintenance-function.sh: tags resources with ManagedBy=Issue-117" {
  # AWS タグ値には '#' が使えないためハイフン表記
  assert_contains "$SCRIPT" 'ManagedBy=Issue-117'
}

# --- 冪等性 ------------------------------------------------------------------

@test "setup-maintenance-function.sh: documents idempotency (re-runnable)" {
  assert_matches "$SCRIPT" 'AlreadyExists|already exists|EntityAlreadyExists|冪等|既に'
}

@test "setup-maintenance-function.sh: prod run invokes both cloudfront and elbv2 commands" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" prod
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
  grep -q '^cloudfront ' "$AWS_MOCK_LOG" || { echo "expected cloudfront call"; cat "$AWS_MOCK_LOG"; return 1; }
  grep -q '^elbv2 ' "$AWS_MOCK_LOG" || { echo "expected elbv2 call"; cat "$AWS_MOCK_LOG"; return 1; }
}
