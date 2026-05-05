#!/usr/bin/env bats
#
# Issue#117: scripts/maintenance-on.sh の動作を検証する。
# このスクリプトはメンテナンスモード ON 切替で、毎リリース時に実行する。
# **ON 時の順序: フロント → API**（ユーザーが「フロントは生きてるのに API 失敗」
# 状態を見ないようにするため）。
#
# Source of truth: documents/04_Issues/Issue#117.md §3.3, §4.6

load helpers

SCRIPT="$REPO_ROOT/scripts/maintenance-on.sh"

@test "maintenance-on.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "maintenance-on.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "maintenance-on.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "maintenance-on.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

# --- 環境引数のサポート ------------------------------------------------------

@test "maintenance-on.sh: requires environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "maintenance-on.sh: rejects invalid environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" staging
  [ "$status" -ne 0 ]
}

@test "maintenance-on.sh: accepts prod" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" prod
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

@test "maintenance-on.sh: accepts test" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" test
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

# --- HTML 埋め込み (build-maintenance-function.sh 呼び出し) -----------------

@test "maintenance-on.sh: invokes build-maintenance-function.sh before publish" {
  assert_contains "$SCRIPT" 'build-maintenance-function.sh'
}

# --- CloudFront Function update / publish (フロント側) -----------------------

@test "maintenance-on.sh: calls describe-function to obtain ETag" {
  assert_contains "$SCRIPT" 'aws cloudfront describe-function'
  assert_contains "$SCRIPT" 'ETag'
}

@test "maintenance-on.sh: updates function with maintenance.js" {
  assert_contains "$SCRIPT" 'aws cloudfront update-function'
  assert_contains "$SCRIPT" 'maintenance.js'
}

@test "maintenance-on.sh: publishes function" {
  assert_contains "$SCRIPT" 'aws cloudfront publish-function'
}

@test "maintenance-on.sh: uses --if-match for optimistic locking" {
  assert_contains "$SCRIPT" '--if-match'
}

@test "maintenance-on.sh: targets photlas-frontend-fn-{env}" {
  assert_matches "$SCRIPT" 'photlas-frontend-fn-'
}

# --- ALB rule priority (API 側) ---------------------------------------------

@test "maintenance-on.sh: changes ALB rule priority via set-rule-priorities" {
  assert_contains "$SCRIPT" 'aws elbv2 set-rule-priorities'
}

@test "maintenance-on.sh: prod active priority is 5" {
  # prod 用の active 値 5 がスクリプト内に出現すること
  assert_matches "$SCRIPT" '\b5\b'
}

@test "maintenance-on.sh: test active priority is 6" {
  assert_matches "$SCRIPT" '\b6\b'
}

# --- 切替順序: フロント → API ------------------------------------------------

@test "maintenance-on.sh prod: front (cloudfront update-function) precedes API (elbv2 set-rule-priorities)" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  bash "$SCRIPT" prod
  assert_aws_call_order '^cloudfront update-function' '^elbv2 set-rule-priorities'
}

@test "maintenance-on.sh test: front precedes API in staging" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  bash "$SCRIPT" test
  assert_aws_call_order '^cloudfront update-function' '^elbv2 set-rule-priorities'
}

# --- 確認ステップ ------------------------------------------------------------

@test "maintenance-on.sh: waits for CloudFront Function propagation (sleep)" {
  assert_contains "$SCRIPT" 'sleep'
}

@test "maintenance-on.sh: verifies via curl" {
  assert_contains "$SCRIPT" 'curl'
}
