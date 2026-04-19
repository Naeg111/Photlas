#!/bin/bash
#
# Shared helpers for Issue#97 WAF managed-rule scripts.
# Sourced by:
#   scripts/setup-waf-managed-rules-alarm.sh
#   scripts/waf-block-switch.sh
#
# This library provides ONE source of truth for:
#   - The mapping between a WebACL rule name and its CloudWatch alarm short
#     name / 5-minute threshold (Issue#97 §3.5)
#   - A common alarm-naming convention: photlas-waf-<ShortName>-<Suffix>
#     where <Suffix> is "Counted" in Count mode and "Blocked" in Block mode
#
# The actual `aws cloudwatch put-metric-alarm` invocation is intentionally kept
# in each caller script (not inside this library) so that each script remains
# self-documenting about which AWS APIs it invokes.
#
# Issue#97.md §3.5 alarm spec (5-minute window):
#   AmazonIpReputationList   -> IpReputation    threshold 100
#   KnownBadInputsRuleSet    -> KnownBadInputs  threshold  20
#   SQLiRuleSet              -> SQLi            threshold   5
#   CommonRuleSet            -> CommonRuleSet   threshold  50
#

# Echo the alarm short-name for a given WebACL rule display name.
# Short name is used in alarm names: photlas-waf-<ShortName>-<Suffix>.
# Exits 1 with a descriptive message on unknown input.
waf_managed_alarm_short_name() {
  local rule_name="$1"
  case "$rule_name" in
    AmazonIpReputationList)  echo "IpReputation"   ;;
    KnownBadInputsRuleSet)   echo "KnownBadInputs" ;;
    SQLiRuleSet)             echo "SQLi"           ;;
    CommonRuleSet)           echo "CommonRuleSet"  ;;
    *)
      echo "waf_managed_alarm_short_name: unknown rule '$rule_name'" >&2
      return 1
      ;;
  esac
}

# Echo the 5-minute CountedRequests/BlockedRequests threshold (§3.5).
# Exits 1 with a descriptive message on unknown input.
waf_managed_alarm_threshold() {
  local rule_name="$1"
  case "$rule_name" in
    AmazonIpReputationList)  echo 100 ;;
    KnownBadInputsRuleSet)   echo  20 ;;
    SQLiRuleSet)             echo   5 ;;
    CommonRuleSet)           echo  50 ;;
    *)
      echo "waf_managed_alarm_threshold: unknown rule '$rule_name'" >&2
      return 1
      ;;
  esac
}

# Compose the alarm name for (rule, suffix).
# Example: waf_managed_alarm_name SQLiRuleSet Counted -> photlas-waf-SQLi-Counted
waf_managed_alarm_name() {
  local rule_name="$1"
  local suffix="$2"
  local short
  short="$(waf_managed_alarm_short_name "$rule_name")" || return 1
  echo "photlas-waf-${short}-${suffix}"
}

# Echo the list of Issue#97 managed rule display names, one per line.
# Used by caller scripts to iterate over all 4 managed rules.
waf_managed_rule_names() {
  cat <<'EOF'
AmazonIpReputationList
KnownBadInputsRuleSet
SQLiRuleSet
CommonRuleSet
EOF
}
