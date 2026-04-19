#!/usr/bin/env bats
#
# Specification-driven tests for scripts/waf-block-switch.sh
# Source of truth: documents/04_Issues/Issue#97.md §3.3, §3.5, §3.6
# Used by PR2-4 (Count → Block per-rule cutover) and for rollback Block → Count.
#
# The script targets ONE managed rule at a time (argument) and:
#   1. Flips OverrideAction on that rule:
#        block -> remove OverrideAction so RuleActionOverrides (pre-set to
#                 Block + 429 CustomResponse) activate
#        count -> set OverrideAction: Count (rollback)
#   2. Replaces the corresponding CloudWatch alarm between
#      CountedRequests <-> BlockedRequests metrics
#
# Usage:
#   ./scripts/waf-block-switch.sh <count|block> <rule-name>
# where <rule-name> is one of:
#   CommonRuleSet | KnownBadInputsRuleSet | SQLiRuleSet | AmazonIpReputationList

load helpers

SCRIPT="$SCRIPTS_DIR/waf-block-switch.sh"

@test "waf-block-switch.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "waf-block-switch.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "waf-block-switch.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "waf-block-switch.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "waf-block-switch.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- CLI argument handling ---------------------------------------------------

@test "waf-block-switch.sh: accepts count/block mode argument" {
  assert_matches "$SCRIPT" '\bcount\b|\bblock\b'
}

@test "waf-block-switch.sh: accepts rule-name argument" {
  # Usage text or case statement enumerating the managed rule names
  assert_matches "$SCRIPT" 'Usage|usage:'
  assert_contains "$SCRIPT" 'CommonRuleSet'
  assert_contains "$SCRIPT" 'KnownBadInputsRuleSet'
  assert_contains "$SCRIPT" 'SQLiRuleSet'
  assert_contains "$SCRIPT" 'AmazonIpReputationList'
}

@test "waf-block-switch.sh: rejects invalid mode or rule-name" {
  assert_matches "$SCRIPT" 'Usage|usage:|Invalid|unknown'
}

# --- WebACL update via update-web-acl with LockToken ------------------------

@test "waf-block-switch.sh: targets photlas-waf-main WebACL" {
  assert_contains "$SCRIPT" 'photlas-waf-main'
}

@test "waf-block-switch.sh: uses REGIONAL scope" {
  assert_contains "$SCRIPT" 'REGIONAL'
}

@test "waf-block-switch.sh: calls wafv2 get-web-acl (for LockToken)" {
  assert_contains "$SCRIPT" 'aws wafv2 get-web-acl'
  assert_contains "$SCRIPT" 'LockToken'
}

@test "waf-block-switch.sh: calls wafv2 update-web-acl" {
  assert_contains "$SCRIPT" 'aws wafv2 update-web-acl'
}

# --- OverrideAction toggle (§3.3) -------------------------------------------

@test "waf-block-switch.sh: references OverrideAction" {
  # block mode removes it; count mode sets it back to Count -- both paths
  # must mention OverrideAction in the mutation logic.
  assert_contains "$SCRIPT" 'OverrideAction'
}

@test "waf-block-switch.sh: count mode sets OverrideAction to Count" {
  # When rolling back to Count, the rule's OverrideAction must become {Count:{}}
  assert_matches "$SCRIPT" 'OverrideAction[^A-Za-z]+.*"Count"|"Count":[[:space:]]*\{\}'
}

# --- Alarm metric replacement (§3.5) ----------------------------------------

@test "waf-block-switch.sh: replaces alarm with BlockedRequests on block" {
  assert_contains "$SCRIPT" 'BlockedRequests'
}

@test "waf-block-switch.sh: restores alarm to CountedRequests on count" {
  assert_contains "$SCRIPT" 'CountedRequests'
}

@test "waf-block-switch.sh: uses cloudwatch put-metric-alarm for replacement" {
  assert_contains "$SCRIPT" 'aws cloudwatch put-metric-alarm'
}

@test "waf-block-switch.sh: deletes the old alarm after replacement" {
  # delete-alarms on the stale alarm keeps the 1-alarm-per-rule invariant
  assert_contains "$SCRIPT" 'aws cloudwatch delete-alarms'
}

@test "waf-block-switch.sh: reuses SNS topic photlas-waf-alerts" {
  assert_contains "$SCRIPT" 'photlas-waf-alerts'
}

# --- Tags (Issue#97 resource tags) ------------------------------------------

@test "waf-block-switch.sh: tags alarms with ManagedBy=Issue-97" {
  assert_contains "$SCRIPT" 'ManagedBy=Issue-97'
}

@test "waf-block-switch.sh: tags alarms with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project'
  assert_contains "$SCRIPT" 'Photlas'
}

@test "waf-block-switch.sh: tags alarms with CostCenter=waf" {
  assert_contains "$SCRIPT" 'CostCenter=waf'
}
