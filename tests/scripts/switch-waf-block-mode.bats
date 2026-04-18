#!/usr/bin/env bats
#
# Specification-driven tests for scripts/switch-waf-block-mode.sh
# Source of truth: documents/04_Issues/Issue#94.md §3.1 and §4
#
# The script toggles the WAF WebACL between Count and Block modes in one
# operation, covering all three rules (AuthRateLimit / GeneralRateLimit /
# StagingLooseLimit). It is also used to roll back Block -> Count.
#
# In case α (3-alarm setup), the script additionally re-points the three
# alarms between CountedRequests and BlockedRequests metrics.

load helpers

SCRIPT="$SCRIPTS_DIR/switch-waf-block-mode.sh"

@test "switch-waf-block-mode.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "switch-waf-block-mode.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "switch-waf-block-mode.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "switch-waf-block-mode.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "switch-waf-block-mode.sh: accepts count/block argument" {
  assert_matches "$SCRIPT" '\bcount\b|\bblock\b|Count|Block'
}

@test "switch-waf-block-mode.sh: rejects invalid mode arguments" {
  # Usage or error-message path present
  assert_matches "$SCRIPT" 'Usage|usage:|Invalid'
}

@test "switch-waf-block-mode.sh: targets photlas-waf-main WebACL" {
  assert_contains "$SCRIPT" 'photlas-waf-main'
}

@test "switch-waf-block-mode.sh: calls wafv2 update-web-acl" {
  assert_contains "$SCRIPT" 'aws wafv2 update-web-acl'
}

@test "switch-waf-block-mode.sh: fetches existing WebACL lock token before update" {
  # get-web-acl is required because update-web-acl needs the lock token
  assert_contains "$SCRIPT" 'aws wafv2 get-web-acl'
  assert_contains "$SCRIPT" 'LockToken'
}

@test "switch-waf-block-mode.sh: toggles all three rules in one operation" {
  assert_contains "$SCRIPT" 'AuthRateLimit'
  assert_contains "$SCRIPT" 'GeneralRateLimit'
  assert_contains "$SCRIPT" 'StagingLooseLimit'
}

@test "switch-waf-block-mode.sh: Block mode references RateLimitExceeded custom response" {
  assert_contains "$SCRIPT" 'RateLimitExceeded'
}

@test "switch-waf-block-mode.sh: Block mode uses 429 Custom response code" {
  assert_matches "$SCRIPT" '"ResponseCode":[[:space:]]*429|ResponseCode=429'
}

@test "switch-waf-block-mode.sh: switches alarm metrics between CountedRequests and BlockedRequests (case α)" {
  assert_contains "$SCRIPT" 'CountedRequests'
  assert_contains "$SCRIPT" 'BlockedRequests'
}

@test "switch-waf-block-mode.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

@test "switch-waf-block-mode.sh: uses REGIONAL scope" {
  assert_contains "$SCRIPT" 'REGIONAL'
}
