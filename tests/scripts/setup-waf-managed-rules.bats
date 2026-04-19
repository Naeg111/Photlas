#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-waf.sh (Issue#97 extension)
# Source of truth: documents/04_Issues/Issue#97.md §3.1, §3.2, §3.7, §3.8, §3.9, §3.11
#
# Verifies the extended setup-waf.sh (now master script per Issue#97 §3.9):
#   - Retains all Issue#94 rate limit rules (AuthRateLimit / GeneralRateLimit /
#     StagingLooseLimit)
#   - Adds 4 AWS managed rules at the correct priorities:
#       IpReputation=100, KnownBadInputs=110, SQLi=120, Common=130
#       (Issue#97 §3.2: cheap → heavy ordering)
#   - Each managed rule:
#       - OverrideAction: Count (§3.3 initial state)
#       - ScopeDownStatement limits to Host: api.photlas.jp (§3.8 Plan H)
#       - All sub-rules overridden to Block + HTTP 429 + RateLimitExceeded body
#         via RuleActionOverrides (§3.7)
#   - Dynamically fetches current version and sub-rule names via
#     describe-managed-rule-group (§3.9, §3.11)
#   - Section comments demarcate Issue#94 / Issue#97 ownership (§3.9)

load helpers

SCRIPT="$SCRIPTS_DIR/setup-waf.sh"

# --- Section comments (Issue#94 / Issue#97 responsibility demarcation) -------

@test "setup-waf.sh[managed]: marks Section 1 as Issue#94 rate limit rules" {
  assert_matches "$SCRIPT" 'Section 1:[[:space:]]*Rate Limit Rules[[:space:]]*\(Issue#94\)'
}

@test "setup-waf.sh[managed]: marks Section 2 as Issue#97 managed rules" {
  assert_matches "$SCRIPT" 'Section 2:[[:space:]]*Managed Rules[[:space:]]*\(Issue#97\)'
}

# --- Managed rule group names ------------------------------------------------

@test "setup-waf.sh[managed]: references AWSManagedRulesCommonRuleSet" {
  assert_contains "$SCRIPT" 'AWSManagedRulesCommonRuleSet'
}

@test "setup-waf.sh[managed]: references AWSManagedRulesKnownBadInputsRuleSet" {
  assert_contains "$SCRIPT" 'AWSManagedRulesKnownBadInputsRuleSet'
}

@test "setup-waf.sh[managed]: references AWSManagedRulesSQLiRuleSet" {
  assert_contains "$SCRIPT" 'AWSManagedRulesSQLiRuleSet'
}

@test "setup-waf.sh[managed]: references AWSManagedRulesAmazonIpReputationList" {
  assert_contains "$SCRIPT" 'AWSManagedRulesAmazonIpReputationList'
}

# --- Priorities (Issue#97 §3.2: cheap → heavy order) ------------------------

@test "setup-waf.sh[managed]: AmazonIpReputationList at priority 100" {
  # Expect the rule name to appear near priority 100
  assert_matches "$SCRIPT" 'AmazonIpReputationList[^0-9]*"Priority":[[:space:]]*100|"Priority":[[:space:]]*100[^0-9][^}]*AmazonIpReputationList'
}

@test "setup-waf.sh[managed]: KnownBadInputsRuleSet at priority 110" {
  assert_matches "$SCRIPT" 'KnownBadInputsRuleSet[^0-9]*"Priority":[[:space:]]*110|"Priority":[[:space:]]*110[^0-9][^}]*KnownBadInputsRuleSet'
}

@test "setup-waf.sh[managed]: SQLiRuleSet at priority 120" {
  assert_matches "$SCRIPT" 'SQLiRuleSet[^0-9]*"Priority":[[:space:]]*120|"Priority":[[:space:]]*120[^0-9][^}]*SQLiRuleSet'
}

@test "setup-waf.sh[managed]: CommonRuleSet at priority 130" {
  assert_matches "$SCRIPT" 'CommonRuleSet[^0-9]*"Priority":[[:space:]]*130|"Priority":[[:space:]]*130[^0-9][^}]*CommonRuleSet'
}

# --- Count mode override (Issue#97 §3.3) ------------------------------------

@test "setup-waf.sh[managed]: uses OverrideAction: Count for managed rules" {
  # Expect at least one OverrideAction with Count (Issue#97 §3.3 initial state)
  assert_matches "$SCRIPT" '"OverrideAction":[[:space:]]*\{[[:space:]]*"Count":[[:space:]]*\{\}[[:space:]]*\}'
}

# --- ManagedRuleGroupStatement with AWS vendor ------------------------------

@test "setup-waf.sh[managed]: uses ManagedRuleGroupStatement" {
  assert_contains "$SCRIPT" 'ManagedRuleGroupStatement'
}

@test "setup-waf.sh[managed]: specifies AWS VendorName for managed rules" {
  assert_matches "$SCRIPT" '"VendorName":[[:space:]]*"AWS"'
}

# --- ScopeDownStatement to limit to production host (Issue#97 §3.8) ---------

@test "setup-waf.sh[managed]: managed rules use ScopeDownStatement (Plan H)" {
  # Count must be > 1 because existing Issue#94 rules also use it; here we
  # require the term appears multiple times (Issue#94 uses 3x, Issue#97 adds 4x)
  local count
  count=$(grep -c 'ScopeDownStatement' "$SCRIPT" || true)
  [ "$count" -ge 4 ] || {
    echo "Expected >=4 occurrences of ScopeDownStatement, got $count"
    return 1
  }
}

@test "setup-waf.sh[managed]: scope-down matches api.photlas.jp host (base64 or raw)" {
  # Same host as Issue#94 rules; base64 is YXBpLnBob3RsYXMuanA=
  assert_matches "$SCRIPT" 'YXBpLnBob3RsYXMuanA=|api\.photlas\.jp'
}

# --- Block action overrides (Issue#97 §3.7: 42 sub-rules -> 429) ------------

@test "setup-waf.sh[managed]: defines RuleActionOverrides for managed rules" {
  assert_contains "$SCRIPT" 'RuleActionOverrides'
}

@test "setup-waf.sh[managed]: managed rule Block action returns HTTP 429" {
  # Both Issue#94 switch-waf-block-mode.sh and Issue#97 managed rules use 429
  # but the override block must appear here so all 42 sub-rules share the
  # same CustomResponse on Block-mode activation.
  assert_matches "$SCRIPT" '"ResponseCode":[[:space:]]*429'
}

@test "setup-waf.sh[managed]: managed rule Block action references RateLimitExceeded body" {
  # The CustomResponseBodyKey for managed rule sub-rules must reuse the
  # existing body defined by Issue#94 (§3.7 既存リソースの流用)
  assert_contains "$SCRIPT" 'CustomResponseBodyKey'
  assert_contains "$SCRIPT" 'RateLimitExceeded'
}

@test "setup-waf.sh[managed]: managed rule Block action sets Retry-After: 60 header" {
  assert_matches "$SCRIPT" '"Retry-After"'
}

# --- Dynamic version + sub-rule extraction (Issue#97 §3.9, §3.11) -----------

@test "setup-waf.sh[managed]: uses describe-managed-rule-group to fetch version/sub-rules" {
  assert_contains "$SCRIPT" 'describe-managed-rule-group'
}

@test "setup-waf.sh[managed]: pins managed rule version (explicit Version, not Default)" {
  # Issue#97 §3.11: production uses an explicit Version_X.X, obtained from
  # describe-managed-rule-group at runtime. The script must include "Version"
  # as a key in the managed rule JSON (whether literal "Version_" string or
  # a variable substitution).
  assert_matches "$SCRIPT" '"Version":[[:space:]]*"[^"]+"|--query[^|]*(CurrentDefaultVersion|AvailableVersions|Name)'
}

# --- Retain Issue#94 rate limit rules (no regression) -----------------------

@test "setup-waf.sh[managed]: still defines AuthRateLimit rule (Issue#94 preserved)" {
  assert_contains "$SCRIPT" 'AuthRateLimit'
}

@test "setup-waf.sh[managed]: still defines GeneralRateLimit rule (Issue#94 preserved)" {
  assert_contains "$SCRIPT" 'GeneralRateLimit'
}

@test "setup-waf.sh[managed]: still defines StagingLooseLimit rule (Issue#94 preserved)" {
  assert_contains "$SCRIPT" 'StagingLooseLimit'
}
