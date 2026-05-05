#!/usr/bin/env bats
#
# Issue#117: scripts/maintenance-status.sh の動作を検証する。
# 現在のメンテナンスモード状態 (ON / OFF / partial) を表示する。
# 確認用なので副作用はなく、AWS CLI から状態を取得して出力するだけ。
#
# Source of truth: documents/04_Issues/Issue#117.md §4.5

load helpers

SCRIPT="$REPO_ROOT/scripts/maintenance-status.sh"

@test "maintenance-status.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "maintenance-status.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "maintenance-status.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "maintenance-status.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

# --- 環境引数のサポート ------------------------------------------------------

@test "maintenance-status.sh: requires environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "maintenance-status.sh: rejects invalid environment argument" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" staging
  [ "$status" -ne 0 ]
}

@test "maintenance-status.sh: accepts prod" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" prod
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

@test "maintenance-status.sh: accepts test" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" test
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
}

# --- 状態取得 ---------------------------------------------------------------

@test "maintenance-status.sh: queries CloudFront Function state" {
  assert_contains "$SCRIPT" 'aws cloudfront describe-function'
}

@test "maintenance-status.sh: queries ALB rule priority" {
  assert_contains "$SCRIPT" 'aws elbv2 describe-rules'
}

@test "maintenance-status.sh: targets photlas-frontend-fn-{env}" {
  assert_matches "$SCRIPT" 'photlas-frontend-fn-'
}

# --- 副作用なし -------------------------------------------------------------

@test "maintenance-status.sh: does not modify state (no update-function/set-rule-priorities)" {
  if grep -E 'update-function|publish-function|set-rule-priorities|create-rule|update-distribution' "$SCRIPT" > /dev/null; then
    echo "maintenance-status.sh must be read-only" >&2
    return 1
  fi
}

# --- 出力フォーマット --------------------------------------------------------

@test "maintenance-status.sh: prints status (ON/OFF/maintenance)" {
  setup_aws_mock
  trap teardown_aws_mock EXIT
  run bash "$SCRIPT" prod
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
  # 出力に状態を示すキーワードが含まれること
  echo "$output" | grep -E -i 'on|off|maintenance|passthrough|active|inactive' >/dev/null
}
