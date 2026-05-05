#!/usr/bin/env bats
#
# Issue#117: scripts/maintenance-off.sh の動作を検証する。
# このスクリプトはメンテナンスモード OFF 切替で、毎リリース時に実行する。
# **OFF 時の順序: API → フロント**（フロントが復活した瞬間に API に到達できる
# 状態にするため）。
#
# Source of truth: documents/04_Issues/Issue#117.md §3.3, §4.7

load helpers

SCRIPT="$REPO_ROOT/scripts/maintenance-off.sh"

@test "maintenance-off.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "maintenance-off.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "maintenance-off.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "maintenance-off.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

# --- 環境引数のサポート ------------------------------------------------------

@test "maintenance-off.sh: requires environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "maintenance-off.sh: rejects invalid environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" staging
  [ "$status" -ne 0 ]
}

@test "maintenance-off.sh: accepts prod" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" prod
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

@test "maintenance-off.sh: accepts test" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" test
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

# --- ALB rule priority (API 側) ---------------------------------------------

@test "maintenance-off.sh: changes ALB rule priority via set-rule-priorities" {
  assert_contains "$SCRIPT" 'aws elbv2 set-rule-priorities'
}

@test "maintenance-off.sh: prod inactive priority is 50" {
  assert_matches "$SCRIPT" '\b50\b'
}

@test "maintenance-off.sh: test inactive priority is 51" {
  assert_matches "$SCRIPT" '\b51\b'
}

# --- CloudFront Function update / publish (フロント側) ----------------------

@test "maintenance-off.sh: updates function with passthrough.js" {
  assert_contains "$SCRIPT" 'aws cloudfront update-function'
  assert_contains "$SCRIPT" 'passthrough.js'
}

@test "maintenance-off.sh: publishes function" {
  assert_contains "$SCRIPT" 'aws cloudfront publish-function'
}

@test "maintenance-off.sh: uses --if-match for optimistic locking" {
  assert_contains "$SCRIPT" '--if-match'
}

@test "maintenance-off.sh: targets photlas-frontend-fn-{env}" {
  assert_matches "$SCRIPT" 'photlas-frontend-fn-'
}

# --- 切替順序: API → フロント ------------------------------------------------

@test "maintenance-off.sh prod: API (elbv2 set-rule-priorities) precedes front (cloudfront update-function)" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  bash "$SCRIPT" prod
  assert_aws_call_order '^elbv2 set-rule-priorities' '^cloudfront update-function'
}

@test "maintenance-off.sh test: API precedes front in staging" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  bash "$SCRIPT" test
  assert_aws_call_order '^elbv2 set-rule-priorities' '^cloudfront update-function'
}

# --- 確認ステップ ------------------------------------------------------------

@test "maintenance-off.sh: waits for CloudFront Function propagation (sleep)" {
  assert_contains "$SCRIPT" 'sleep'
}

@test "maintenance-off.sh: verifies via curl" {
  assert_contains "$SCRIPT" 'curl'
}
