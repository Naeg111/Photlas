#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-app-ratelimit-alarm.sh
# Source of truth: documents/04_Issues/Issue#95.md §3.7
#
# Verifies the script:
#   - is syntactically valid (shellcheck passes)
#   - reuses the Issue#94 SNS topic photlas-waf-alerts (does NOT create a new one)
#   - creates a CloudWatch Logs metric filter
#     photlas-app-ratelimit-exceeded-filter on log group /photlas/prod/backend
#     with pattern "レート制限超過", namespace Photlas/RateLimit,
#     metric name AppLayerExceeded, metric value 1, default value 0
#   - creates a CloudWatch alarm photlas-app-ratelimit-exceeded with
#     threshold 10 over 5 minutes (period 300), pointing SNS action
#     at the existing photlas-waf-alerts topic
#   - tags the alarm with Project=Photlas, Environment=production,
#     ManagedBy=Issue-95, CostCenter=observability
#   - is idempotent (safe to re-run)

load helpers

SCRIPT="$SCRIPTS_DIR/setup-app-ratelimit-alarm.sh"

@test "setup-app-ratelimit-alarm.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-app-ratelimit-alarm.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-app-ratelimit-alarm.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-app-ratelimit-alarm.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-app-ratelimit-alarm.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- SNS topic reuse (Issue#94 既存) ----------------------------------------

@test "setup-app-ratelimit-alarm.sh: reuses the Issue#94 SNS topic photlas-waf-alerts" {
  assert_contains "$SCRIPT" 'photlas-waf-alerts'
}

@test "setup-app-ratelimit-alarm.sh: does NOT create a new SNS topic" {
  run grep -E 'aws sns create-topic' "$SCRIPT"
  [ "$status" -ne 0 ]
}

# --- CloudWatch Logs metric filter ------------------------------------------

@test "setup-app-ratelimit-alarm.sh: creates metric filter via put-metric-filter" {
  assert_contains "$SCRIPT" 'aws logs put-metric-filter'
}

@test "setup-app-ratelimit-alarm.sh: uses log group /photlas/prod/backend" {
  assert_contains "$SCRIPT" '/photlas/prod/backend'
}

@test "setup-app-ratelimit-alarm.sh: metric filter name is photlas-app-ratelimit-exceeded-filter" {
  assert_contains "$SCRIPT" 'photlas-app-ratelimit-exceeded-filter'
}

@test "setup-app-ratelimit-alarm.sh: filter pattern matches レート制限超過 log message" {
  assert_contains "$SCRIPT" 'レート制限超過'
}

@test "setup-app-ratelimit-alarm.sh: metric namespace is Photlas/RateLimit" {
  assert_contains "$SCRIPT" 'Photlas/RateLimit'
}

@test "setup-app-ratelimit-alarm.sh: metric name is AppLayerExceeded" {
  assert_contains "$SCRIPT" 'AppLayerExceeded'
}

@test "setup-app-ratelimit-alarm.sh: default metric value is 0" {
  assert_matches "$SCRIPT" 'DefaultValue["]?[[:space:]]*:[[:space:]]*["]?0|default[-_]value[[:space:]=]+0|defaultValue[[:space:]]*=[[:space:]]*0'
}

# --- CloudWatch alarm --------------------------------------------------------

@test "setup-app-ratelimit-alarm.sh: creates alarm via put-metric-alarm" {
  assert_contains "$SCRIPT" 'aws cloudwatch put-metric-alarm'
}

@test "setup-app-ratelimit-alarm.sh: alarm name is photlas-app-ratelimit-exceeded" {
  assert_contains "$SCRIPT" 'photlas-app-ratelimit-exceeded'
}

@test "setup-app-ratelimit-alarm.sh: alarm threshold is 10" {
  assert_matches "$SCRIPT" '--threshold[[:space:]]+10[^0-9]'
}

@test "setup-app-ratelimit-alarm.sh: alarm evaluation period is 300 seconds (5 minutes)" {
  assert_matches "$SCRIPT" '--period[[:space:]]+300|"Period":[[:space:]]*300'
}

@test "setup-app-ratelimit-alarm.sh: alarm uses Sum statistic" {
  assert_contains "$SCRIPT" 'Sum'
}

@test "setup-app-ratelimit-alarm.sh: alarm comparison operator is GreaterThanOrEqualToThreshold" {
  assert_contains "$SCRIPT" 'GreaterThanOrEqualToThreshold'
}

@test "setup-app-ratelimit-alarm.sh: alarm treats missing data as notBreaching" {
  assert_contains "$SCRIPT" 'notBreaching'
}

# --- Idempotency ------------------------------------------------------------

@test "setup-app-ratelimit-alarm.sh: documents idempotency (re-runnable)" {
  assert_matches "$SCRIPT" 'AlreadyExists|already exists|冪等'
}

# --- Tags -------------------------------------------------------------------

@test "setup-app-ratelimit-alarm.sh: tags alarm with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project=Photlas'
}

@test "setup-app-ratelimit-alarm.sh: tags alarm with ManagedBy=Issue-95" {
  # AWS タグ値には '#' が使えないためハイフン表記
  assert_contains "$SCRIPT" 'ManagedBy=Issue-95'
}

@test "setup-app-ratelimit-alarm.sh: tags alarm with CostCenter=observability" {
  assert_contains "$SCRIPT" 'CostCenter=observability'
}

@test "setup-app-ratelimit-alarm.sh: Environment tag uses full spelling (production)" {
  assert_contains "$SCRIPT" 'Environment=production'
}
