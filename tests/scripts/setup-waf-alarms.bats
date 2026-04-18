#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-waf-alarms.sh
# Source of truth: documents/04_Issues/Issue#94.md §4 (case α adoption)
#
# Case α: one alarm per rule (3 alarms total). Metric is CountedRequests
# during Count mode; switched to BlockedRequests at Block cut-over. This
# keeps the alarm count minimal ($0.30/month).
#
# Verifies the script:
#   - creates SNS topic photlas-waf-alerts with email fallback
#     subscription (support@photlas.jp)
#   - creates exactly 3 CloudWatch alarms (AuthRateLimit / GeneralRateLimit
#     / StagingLooseLimit), each watching only its own rule's metric
#   - initial metric is CountedRequests (Count-mode run)
#   - per-rule thresholds: 5 / 20 / 50 for 5-minute window (period 300)
#   - tags all SNS + alarm resources with the issue metadata
#   - is idempotent (re-executable without failing on already-existing
#     resources)

load helpers

SCRIPT="$SCRIPTS_DIR/setup-waf-alarms.sh"

@test "setup-waf-alarms.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-waf-alarms.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-waf-alarms.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-waf-alarms.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-waf-alarms.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- SNS topic --------------------------------------------------------------

@test "setup-waf-alarms.sh: creates SNS topic photlas-waf-alerts" {
  assert_contains "$SCRIPT" 'aws sns create-topic'
  assert_contains "$SCRIPT" 'photlas-waf-alerts'
}

@test "setup-waf-alarms.sh: subscribes fallback email support@photlas.jp" {
  assert_contains "$SCRIPT" 'aws sns subscribe'
  assert_contains "$SCRIPT" 'support@photlas.jp'
  assert_contains "$SCRIPT" 'email'
}

# --- Case α: three alarms, one per rule, CountedRequests metric -------------

@test "setup-waf-alarms.sh: creates alarm for AuthRateLimit rule" {
  assert_contains "$SCRIPT" 'AuthRateLimit'
}

@test "setup-waf-alarms.sh: creates alarm for GeneralRateLimit rule" {
  assert_contains "$SCRIPT" 'GeneralRateLimit'
}

@test "setup-waf-alarms.sh: creates alarm for StagingLooseLimit rule" {
  assert_contains "$SCRIPT" 'StagingLooseLimit'
}

@test "setup-waf-alarms.sh: uses put-metric-alarm API" {
  assert_contains "$SCRIPT" 'aws cloudwatch put-metric-alarm'
}

@test "setup-waf-alarms.sh: initial metric is CountedRequests (case α)" {
  assert_contains "$SCRIPT" 'CountedRequests'
}

@test "setup-waf-alarms.sh: uses AWS/WAFV2 namespace" {
  assert_contains "$SCRIPT" 'AWS/WAFV2'
}

@test "setup-waf-alarms.sh: alarm period is 300 seconds (5-minute window)" {
  assert_matches "$SCRIPT" '--period[[:space:]]+300|"Period":[[:space:]]*300'
}

@test "setup-waf-alarms.sh: AuthRateLimit threshold is 5 per 5 min" {
  # The Auth alarm threshold line must contain 5 on the same --threshold flag
  assert_matches "$SCRIPT" '--threshold[[:space:]]+5[^0-9]'
}

@test "setup-waf-alarms.sh: GeneralRateLimit threshold is 20 per 5 min" {
  assert_matches "$SCRIPT" '--threshold[[:space:]]+20[^0-9]'
}

@test "setup-waf-alarms.sh: StagingLooseLimit threshold is 50 per 5 min" {
  assert_matches "$SCRIPT" '--threshold[[:space:]]+50[^0-9]'
}

# --- Idempotency ------------------------------------------------------------

@test "setup-waf-alarms.sh: documents idempotency (re-runnable)" {
  # Accept any of: EntityAlreadyExistsException, AlreadyExists, already exists, 冪等
  assert_matches "$SCRIPT" 'AlreadyExists|already exists|冪等'
}

# --- Tags -------------------------------------------------------------------

@test "setup-waf-alarms.sh: tags resources with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project=Photlas'
}

@test "setup-waf-alarms.sh: tags resources with ManagedBy=Issue-94" {
  # AWS タグ値には '#' が使えないためハイフン表記
  assert_contains "$SCRIPT" 'ManagedBy=Issue-94'
}

@test "setup-waf-alarms.sh: tags resources with CostCenter=waf" {
  assert_contains "$SCRIPT" 'CostCenter=waf'
}

@test "setup-waf-alarms.sh: Environment tag uses full spelling (production)" {
  assert_contains "$SCRIPT" 'Environment=production'
}

@test "setup-waf-alarms.sh: StagingLooseLimit alarm uses Environment=staging" {
  assert_contains "$SCRIPT" 'Environment=staging'
}
