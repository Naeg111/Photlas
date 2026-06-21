#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-synthetics-canary.sh
# Source of truth: documents/04_Issues/Issue#148.md §4 / §4.1 / §4.2 / §6.1
#
# Verifies the script:
#   - is syntactically valid (shellcheck passes), bash + strict mode
#   - targets ap-northeast-1 and the prod site photlas.jp
#   - creates ONE CloudWatch Synthetics canary (syn-nodejs-puppeteer runtime,
#     30-minute schedule) from the scripts/canary/ source
#   - is idempotent (get-canary → update-canary or create-canary)
#   - reuses the existing SNS topic photlas-waf-alerts and does NOT create one,
#     verifies the topic exists (fail-fast) and warns on no confirmed subscription
#   - creates a CloudWatch alarm on SuccessPercent < 100 that fires only after
#     2 consecutive failures (evaluation-periods 2 / datapoints-to-alarm 2),
#     wiring BOTH alarm-actions and ok-actions to the SNS topic
#   - provisions a canary IAM role and an artifacts S3 bucket
#   - tags resources with Project/Environment/ManagedBy=Issue-148

load helpers

SCRIPT="$SCRIPTS_DIR/setup-synthetics-canary.sh"

@test "setup-synthetics-canary.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-synthetics-canary.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-synthetics-canary.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-synthetics-canary.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-synthetics-canary.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

@test "setup-synthetics-canary.sh: monitors the prod site photlas.jp" {
  assert_contains "$SCRIPT" 'photlas.jp'
}

# --- Canary creation --------------------------------------------------------

@test "setup-synthetics-canary.sh: creates a Synthetics canary" {
  assert_contains "$SCRIPT" 'aws synthetics create-canary'
}

@test "setup-synthetics-canary.sh: uses the syn-nodejs-puppeteer runtime" {
  assert_matches "$SCRIPT" 'syn-nodejs-puppeteer'
}

@test "setup-synthetics-canary.sh: schedules the canary every 30 minutes" {
  assert_contains "$SCRIPT" 'rate(30 minutes)'
}

@test "setup-synthetics-canary.sh: bundles the scripts/canary source" {
  assert_contains "$SCRIPT" 'scripts/canary'
}

@test "setup-synthetics-canary.sh: is idempotent (checks existence via get-canary)" {
  assert_contains "$SCRIPT" 'aws synthetics get-canary'
}

@test "setup-synthetics-canary.sh: updates the canary when it already exists" {
  assert_contains "$SCRIPT" 'aws synthetics update-canary'
}

# --- SNS topic reuse (Issue + setup-cloudwatch-alarms.sh) -------------------

@test "setup-synthetics-canary.sh: reuses the existing SNS topic photlas-waf-alerts" {
  assert_contains "$SCRIPT" 'photlas-waf-alerts'
}

@test "setup-synthetics-canary.sh: does NOT create a new SNS topic" {
  run grep -E 'aws sns create-topic' "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "setup-synthetics-canary.sh: fails fast if the SNS topic does not exist" {
  # 既存トピックの存在確認に list-topics か get-topic-attributes を使う
  run bash -c "grep -Eq 'aws sns (list-topics|get-topic-attributes)' '$SCRIPT'"
  [ "$status" -eq 0 ]
}

@test "setup-synthetics-canary.sh: checks for a confirmed subscription" {
  assert_contains "$SCRIPT" 'list-subscriptions-by-topic'
}

# --- CloudWatch alarm -------------------------------------------------------

@test "setup-synthetics-canary.sh: creates a CloudWatch alarm" {
  assert_contains "$SCRIPT" 'aws cloudwatch put-metric-alarm'
}

@test "setup-synthetics-canary.sh: alarms on the SuccessPercent metric" {
  assert_contains "$SCRIPT" 'SuccessPercent'
}

@test "setup-synthetics-canary.sh: uses the CloudWatchSynthetics namespace" {
  assert_contains "$SCRIPT" 'CloudWatchSynthetics'
}

@test "setup-synthetics-canary.sh: fires only after 2 consecutive failures" {
  assert_matches "$SCRIPT" '--evaluation-periods[ =]+2'
  assert_matches "$SCRIPT" '--datapoints-to-alarm[ =]+2'
}

@test "setup-synthetics-canary.sh: compares SuccessPercent below threshold 100" {
  assert_contains "$SCRIPT" 'LessThanThreshold'
  assert_matches "$SCRIPT" '--threshold[ =]+100'
}

@test "setup-synthetics-canary.sh: wires both alarm-actions and ok-actions to SNS" {
  assert_contains "$SCRIPT" '--alarm-actions'
  assert_contains "$SCRIPT" '--ok-actions'
}

# --- IAM role / artifacts bucket / tags -------------------------------------

@test "setup-synthetics-canary.sh: provisions a canary IAM role" {
  assert_matches "$SCRIPT" 'iam (create-role|get-role)'
}

@test "setup-synthetics-canary.sh: uses an S3 artifacts location" {
  assert_matches "$SCRIPT" 's3://|ArtifactS3Location|artifact'
}

@test "setup-synthetics-canary.sh: tags resources with ManagedBy=Issue-148" {
  assert_contains "$SCRIPT" 'Issue-148'
}

@test "setup-synthetics-canary.sh: tags resources with Project=Photlas" {
  assert_contains "$SCRIPT" 'Photlas'
}
