#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-waf-managed-rules-alarm.sh
# Source of truth: documents/04_Issues/Issue#97.md §3.5
#
# Verifies the Count-mode alarm setup script creates 4 CloudWatch alarms
# (one per managed rule) that watch CountedRequests and publish to the
# existing Issue#94 SNS topic photlas-waf-alerts.
#
# Alarms and thresholds (§3.5):
#   photlas-waf-IpReputation-Counted    : 100 per 5 min
#   photlas-waf-KnownBadInputs-Counted  :  20 per 5 min
#   photlas-waf-SQLi-Counted            :   5 per 5 min
#   photlas-waf-CommonRuleSet-Counted   :  50 per 5 min
#
# Resource tags (§3.5):
#   Project=Photlas, Environment=production, ManagedBy=Issue-97, CostCenter=waf

load helpers

SCRIPT="$SCRIPTS_DIR/setup-waf-managed-rules-alarm.sh"

@test "setup-waf-managed-rules-alarm.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-waf-managed-rules-alarm.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-waf-managed-rules-alarm.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-waf-managed-rules-alarm.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-waf-managed-rules-alarm.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- SNS topic reuse (Issue#94) ---------------------------------------------

@test "setup-waf-managed-rules-alarm.sh: reuses SNS topic photlas-waf-alerts" {
  assert_contains "$SCRIPT" 'photlas-waf-alerts'
}

@test "setup-waf-managed-rules-alarm.sh: looks up existing SNS topic (does not recreate)" {
  # Issue#97 §3.5: 「既存 SNS `photlas-waf-alerts`（Issue#94 既存）を流用」
  # The script should list or look up the existing topic, not call create-topic.
  assert_matches "$SCRIPT" 'sns list-topics|sns get-topic-attributes'
}

# --- WebACL pre-check --------------------------------------------------------

@test "setup-waf-managed-rules-alarm.sh: targets photlas-waf-main WebACL" {
  assert_contains "$SCRIPT" 'photlas-waf-main'
}

# --- Alarm creation -----------------------------------------------------------

@test "setup-waf-managed-rules-alarm.sh: calls cloudwatch put-metric-alarm" {
  assert_contains "$SCRIPT" 'aws cloudwatch put-metric-alarm'
}

@test "setup-waf-managed-rules-alarm.sh: monitors CountedRequests metric (Count mode)" {
  assert_contains "$SCRIPT" 'CountedRequests'
}

@test "setup-waf-managed-rules-alarm.sh: uses AWS/WAFV2 namespace" {
  assert_contains "$SCRIPT" 'AWS/WAFV2'
}

@test "setup-waf-managed-rules-alarm.sh: uses 5-minute (300 sec) evaluation period" {
  assert_matches "$SCRIPT" '--period[[:space:]]+300|"Period":[[:space:]]*300'
}

# --- 4 alarms (one per managed rule) ----------------------------------------

@test "setup-waf-managed-rules-alarm.sh: creates photlas-waf-CommonRuleSet-Counted alarm" {
  assert_contains "$SCRIPT" 'photlas-waf-CommonRuleSet-Counted'
}

@test "setup-waf-managed-rules-alarm.sh: creates photlas-waf-KnownBadInputs-Counted alarm" {
  assert_contains "$SCRIPT" 'photlas-waf-KnownBadInputs-Counted'
}

@test "setup-waf-managed-rules-alarm.sh: creates photlas-waf-SQLi-Counted alarm" {
  assert_contains "$SCRIPT" 'photlas-waf-SQLi-Counted'
}

@test "setup-waf-managed-rules-alarm.sh: creates photlas-waf-IpReputation-Counted alarm" {
  assert_contains "$SCRIPT" 'photlas-waf-IpReputation-Counted'
}

# --- Thresholds (Issue#97 §3.5) ---------------------------------------------

@test "setup-waf-managed-rules-alarm.sh: CommonRuleSet threshold is 50 per 5 min" {
  assert_matches "$SCRIPT" 'CommonRuleSet[[:space:]]*"[[:space:]]*\\\\?[[:space:]]*(50|"50")|(^|[^0-9])50([^0-9]|$)[^/]*CommonRuleSet|CommonRuleSet[^0-9]+50($|[^0-9])'
}

@test "setup-waf-managed-rules-alarm.sh: KnownBadInputs threshold is 20 per 5 min" {
  assert_matches "$SCRIPT" 'KnownBadInputs[^0-9]+20($|[^0-9])|(^|[^0-9])20[^/]*KnownBadInputs'
}

@test "setup-waf-managed-rules-alarm.sh: SQLi threshold is 5 per 5 min" {
  assert_matches "$SCRIPT" 'SQLi[^0-9]+5($|[^0-9])|(^|[^0-9])5[^/]*SQLi'
}

@test "setup-waf-managed-rules-alarm.sh: IpReputation threshold is 100 per 5 min" {
  assert_matches "$SCRIPT" 'IpReputation[^0-9]+100($|[^0-9])|(^|[^0-9])100[^/]*IpReputation'
}

# --- Dimension names -----------------------------------------------

@test "setup-waf-managed-rules-alarm.sh: uses WebACL dimension name" {
  assert_matches "$SCRIPT" 'Name=WebACL|"Name":[[:space:]]*"WebACL"'
}

@test "setup-waf-managed-rules-alarm.sh: uses Rule dimension name" {
  assert_matches "$SCRIPT" 'Name=Rule|"Name":[[:space:]]*"Rule"'
}

@test "setup-waf-managed-rules-alarm.sh: uses Region dimension name" {
  assert_matches "$SCRIPT" 'Name=Region|"Name":[[:space:]]*"Region"'
}

# --- Resource tags (Issue#97 §3.5 タグ) -------------------------------------

@test "setup-waf-managed-rules-alarm.sh: tags alarms with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project'
  assert_contains "$SCRIPT" 'Photlas'
}

@test "setup-waf-managed-rules-alarm.sh: tags alarms with Environment=production" {
  assert_contains "$SCRIPT" 'Environment=production'
}

@test "setup-waf-managed-rules-alarm.sh: tags alarms with ManagedBy=Issue-97 (hyphen)" {
  # AWS タグ値には '#' が使えないためハイフン表記（Issue#94 と同じ方針）
  assert_contains "$SCRIPT" 'ManagedBy=Issue-97'
}

@test "setup-waf-managed-rules-alarm.sh: tags alarms with CostCenter=waf" {
  assert_contains "$SCRIPT" 'CostCenter=waf'
}
