#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-waf.sh
# Source of truth: documents/04_Issues/Issue#94.md §3.1
#
# Verifies the script:
#   - is syntactically valid (shellcheck passes)
#   - creates the expected AWS resources (S3 / IAM / Firehose / WebACL)
#   - encodes the three WAF rules (AuthRateLimit / GeneralRateLimit /
#     StagingLooseLimit) with the correct priorities, hosts, limits,
#     FORWARDED_IP aggregation, and LOWERCASE transformation
#   - defines the CustomResponseBodies "RateLimitExceeded" key with the
#     required JSON body (code: RATE_LIMIT_EXCEEDED, retryAfter: 60)
#   - redacts the Authorization header in WAF logs
#   - associates the WebACL with photlas-alb
#   - tags all resources with Project/ManagedBy/CostCenter/Environment

load helpers

SCRIPT="$SCRIPTS_DIR/setup-waf.sh"

@test "setup-waf.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-waf.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-waf.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-waf.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-waf.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- S3 bucket for WAF logs -------------------------------------------------

@test "setup-waf.sh: creates S3 bucket photlas-waf-logs-<ACCOUNT_ID>" {
  assert_contains "$SCRIPT" 'photlas-waf-logs-'
  assert_contains "$SCRIPT" 'aws s3api create-bucket'
}

@test "setup-waf.sh: enables SSE-S3 encryption on the log bucket" {
  assert_contains "$SCRIPT" 'put-bucket-encryption'
  assert_contains "$SCRIPT" 'AES256'
}

@test "setup-waf.sh: blocks public access on the log bucket" {
  assert_contains "$SCRIPT" 'put-public-access-block'
  assert_contains "$SCRIPT" 'BlockPublicAcls=true'
}

@test "setup-waf.sh: applies 90-day lifecycle expiration on the log bucket" {
  assert_contains "$SCRIPT" 'put-bucket-lifecycle-configuration'
  assert_matches "$SCRIPT" 'Days["]?[[:space:]]*:[[:space:]]*["]?90'
}

# --- IAM role for Firehose --------------------------------------------------

@test "setup-waf.sh: creates IAM role for Firehose" {
  assert_contains "$SCRIPT" 'aws iam create-role'
  assert_contains "$SCRIPT" 'firehose.amazonaws.com'
}

# --- Kinesis Data Firehose --------------------------------------------------

@test "setup-waf.sh: creates Firehose delivery stream with aws-waf-logs- prefix" {
  assert_contains "$SCRIPT" 'aws firehose create-delivery-stream'
  assert_contains "$SCRIPT" 'aws-waf-logs-'
}

@test "setup-waf.sh: uses GZIP compression for Firehose -> S3" {
  assert_contains "$SCRIPT" 'GZIP'
}

# --- WebACL (CustomResponseBodies + 3 rules) --------------------------------

@test "setup-waf.sh: creates WebACL photlas-waf-main" {
  assert_contains "$SCRIPT" 'aws wafv2 create-web-acl'
  assert_contains "$SCRIPT" 'photlas-waf-main'
}

@test "setup-waf.sh: WebACL uses REGIONAL scope" {
  assert_matches "$SCRIPT" '--scope[[:space:]]+REGIONAL|"Scope":[[:space:]]*"REGIONAL"|Scope=REGIONAL'
}

@test "setup-waf.sh: defines CustomResponseBodies key RateLimitExceeded" {
  assert_contains "$SCRIPT" 'CustomResponseBodies'
  assert_contains "$SCRIPT" 'RateLimitExceeded'
}

@test "setup-waf.sh: custom response body JSON includes RATE_LIMIT_EXCEEDED code" {
  assert_contains "$SCRIPT" 'RATE_LIMIT_EXCEEDED'
}

@test "setup-waf.sh: custom response body JSON includes retryAfter: 60" {
  assert_matches "$SCRIPT" '"retryAfter":[[:space:]]*60'
}

@test "setup-waf.sh: custom response body JSON includes Too Many Requests error" {
  assert_contains "$SCRIPT" 'Too Many Requests'
}

# AuthRateLimit
@test "setup-waf.sh: rule AuthRateLimit with priority 10" {
  assert_contains "$SCRIPT" 'AuthRateLimit'
  assert_matches "$SCRIPT" '"Priority":[[:space:]]*10|Priority=10'
}

@test "setup-waf.sh: AuthRateLimit limit is 100 per 5 min" {
  assert_matches "$SCRIPT" '"Limit":[[:space:]]*100|Limit=100'
}

@test "setup-waf.sh: AuthRateLimit scope-down covers api.photlas.jp host" {
  assert_contains "$SCRIPT" 'api.photlas.jp'
}

@test "setup-waf.sh: AuthRateLimit scope-down covers /api/v1/auth/ path" {
  assert_contains "$SCRIPT" '/api/v1/auth/'
}

# GeneralRateLimit
@test "setup-waf.sh: rule GeneralRateLimit with priority 20" {
  assert_contains "$SCRIPT" 'GeneralRateLimit'
  assert_matches "$SCRIPT" '"Priority":[[:space:]]*20|Priority=20'
}

@test "setup-waf.sh: GeneralRateLimit limit is 2000 per 5 min" {
  assert_matches "$SCRIPT" '"Limit":[[:space:]]*2000|Limit=2000'
}

# StagingLooseLimit
@test "setup-waf.sh: rule StagingLooseLimit with priority 30" {
  assert_contains "$SCRIPT" 'StagingLooseLimit'
  assert_matches "$SCRIPT" '"Priority":[[:space:]]*30|Priority=30'
}

@test "setup-waf.sh: StagingLooseLimit limit is 5000 per 5 min" {
  assert_matches "$SCRIPT" '"Limit":[[:space:]]*5000|Limit=5000'
}

@test "setup-waf.sh: StagingLooseLimit scope-down covers test-api.photlas.jp" {
  assert_contains "$SCRIPT" 'test-api.photlas.jp'
}

# All three rules share these properties
@test "setup-waf.sh: uses FORWARDED_IP aggregation" {
  assert_contains "$SCRIPT" 'FORWARDED_IP'
}

@test "setup-waf.sh: uses X-Forwarded-For header for FORWARDED_IP config" {
  assert_contains "$SCRIPT" 'X-Forwarded-For'
}

@test "setup-waf.sh: FORWARDED_IP fallback is NO_MATCH" {
  assert_contains "$SCRIPT" 'NO_MATCH'
}

@test "setup-waf.sh: applies LOWERCASE text transformation on host/path match" {
  assert_contains "$SCRIPT" 'LOWERCASE'
}

@test "setup-waf.sh: rules start in Count mode (initial action)" {
  assert_contains "$SCRIPT" '"Count"'
}

# --- Logging configuration --------------------------------------------------

@test "setup-waf.sh: configures WAF logging to Firehose" {
  assert_contains "$SCRIPT" 'aws wafv2 put-logging-configuration'
}

@test "setup-waf.sh: redacts Authorization header in WAF logs" {
  assert_contains "$SCRIPT" 'Authorization'
  assert_matches "$SCRIPT" 'RedactedFields|"Name":[[:space:]]*"authorization"'
}

# --- ALB association --------------------------------------------------------

@test "setup-waf.sh: associates WebACL with photlas-alb" {
  assert_contains "$SCRIPT" 'aws wafv2 associate-web-acl'
  assert_contains "$SCRIPT" 'photlas-alb'
}

# --- Resource tags ----------------------------------------------------------

@test "setup-waf.sh: tags resources with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project=Photlas'
}

@test "setup-waf.sh: tags resources with ManagedBy=Issue#94" {
  assert_contains "$SCRIPT" 'ManagedBy=Issue#94'
}

@test "setup-waf.sh: tags resources with CostCenter=waf" {
  assert_contains "$SCRIPT" 'CostCenter=waf'
}

@test "setup-waf.sh: tags include Environment=production or staging (full spelling)" {
  assert_contains "$SCRIPT" 'Environment=production'
}
