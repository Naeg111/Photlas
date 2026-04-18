#!/usr/bin/env bats
#
# Specification-driven tests for scripts/setup-alb-access-logs.sh
# Source of truth: documents/04_Issues/Issue#95.md §3.6
#
# Verifies the script:
#   - is syntactically valid (shellcheck passes)
#   - creates the S3 bucket photlas-alb-logs-<ACCOUNT_ID> with:
#     - SSE-S3 (AES256) encryption
#     - public access fully blocked
#     - 90-day lifecycle expiration
#   - applies a bucket policy granting PutObject to
#     arn:aws:iam::582318560864:root (ap-northeast-1 ALB log delivery
#     account) and the delivery.logs.amazonaws.com service principal
#   - enables ALB access logs via modify-load-balancer-attributes
#     (access_logs.s3.enabled=true, bucket name, prefix=photlas-alb)
#   - tags all resources with Project=Photlas, Environment=production,
#     ManagedBy=Issue-95, CostCenter=observability
#   - is idempotent (safe to re-run)

load helpers

SCRIPT="$SCRIPTS_DIR/setup-alb-access-logs.sh"

@test "setup-alb-access-logs.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "setup-alb-access-logs.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "setup-alb-access-logs.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "setup-alb-access-logs.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "setup-alb-access-logs.sh: targets ap-northeast-1 region" {
  assert_contains "$SCRIPT" 'ap-northeast-1'
}

# --- S3 bucket for ALB access logs ------------------------------------------

@test "setup-alb-access-logs.sh: creates S3 bucket photlas-alb-logs-<ACCOUNT_ID>" {
  assert_contains "$SCRIPT" 'photlas-alb-logs-'
  assert_contains "$SCRIPT" 'aws s3api create-bucket'
}

@test "setup-alb-access-logs.sh: enables SSE-S3 encryption on the log bucket" {
  assert_contains "$SCRIPT" 'put-bucket-encryption'
  assert_contains "$SCRIPT" 'AES256'
}

@test "setup-alb-access-logs.sh: blocks public access on the log bucket" {
  assert_contains "$SCRIPT" 'put-public-access-block'
  assert_contains "$SCRIPT" 'BlockPublicAcls=true'
}

@test "setup-alb-access-logs.sh: applies 90-day lifecycle expiration" {
  assert_contains "$SCRIPT" 'put-bucket-lifecycle-configuration'
  assert_matches "$SCRIPT" 'Days["]?[[:space:]]*:[[:space:]]*["]?90'
}

# --- Bucket policy ----------------------------------------------------------

@test "setup-alb-access-logs.sh: applies bucket policy with put-bucket-policy" {
  assert_contains "$SCRIPT" 'aws s3api put-bucket-policy'
}

@test "setup-alb-access-logs.sh: bucket policy grants PutObject to ALB log delivery AWS account (582318560864)" {
  assert_contains "$SCRIPT" '582318560864'
  assert_contains "$SCRIPT" 's3:PutObject'
}

@test "setup-alb-access-logs.sh: bucket policy includes delivery.logs.amazonaws.com service principal" {
  assert_contains "$SCRIPT" 'delivery.logs.amazonaws.com'
}

@test "setup-alb-access-logs.sh: bucket policy allows GetBucketAcl for log delivery service" {
  assert_contains "$SCRIPT" 's3:GetBucketAcl'
}

# --- ALB attribute modification ---------------------------------------------

@test "setup-alb-access-logs.sh: uses modify-load-balancer-attributes to enable access logs" {
  assert_contains "$SCRIPT" 'aws elbv2 modify-load-balancer-attributes'
  assert_contains "$SCRIPT" 'access_logs.s3.enabled'
}

@test "setup-alb-access-logs.sh: sets ALB access log prefix to photlas-alb" {
  assert_contains "$SCRIPT" 'access_logs.s3.prefix'
  assert_contains "$SCRIPT" 'photlas-alb'
}

@test "setup-alb-access-logs.sh: references the photlas-alb load balancer" {
  assert_contains "$SCRIPT" 'photlas-alb'
}

# --- Idempotency ------------------------------------------------------------

@test "setup-alb-access-logs.sh: documents idempotency (re-runnable)" {
  assert_matches "$SCRIPT" 'AlreadyExists|already exists|冪等'
}

# --- Tags -------------------------------------------------------------------

@test "setup-alb-access-logs.sh: tags resources with Project=Photlas" {
  assert_contains "$SCRIPT" 'Project=Photlas'
}

@test "setup-alb-access-logs.sh: tags resources with ManagedBy=Issue-95" {
  # AWS タグ値には '#' が使えないためハイフン表記
  assert_contains "$SCRIPT" 'ManagedBy=Issue-95'
}

@test "setup-alb-access-logs.sh: tags resources with CostCenter=observability" {
  assert_contains "$SCRIPT" 'CostCenter=observability'
}

@test "setup-alb-access-logs.sh: Environment tag uses full spelling (production)" {
  assert_contains "$SCRIPT" 'Environment=production'
}
