#!/usr/bin/env bats
#
# Issue#117: scripts/build-maintenance-function.sh の動作を検証する。
# このスクリプトは scripts/maintenance.html を読み込み、エスケープして
# scripts/cloudfront-function/maintenance.js.template に埋め込み、
# scripts/cloudfront-function/maintenance.js を生成する。
#
# Source of truth: documents/04_Issues/Issue#117.md §4.4, §4.5

load helpers

SCRIPT="$REPO_ROOT/scripts/build-maintenance-function.sh"
TEMPLATE="$REPO_ROOT/scripts/cloudfront-function/maintenance.js.template"
OUTPUT="$REPO_ROOT/scripts/cloudfront-function/maintenance.js"

@test "build-maintenance-function.sh: exists and is executable" {
  assert_script_executable "$SCRIPT"
}

@test "build-maintenance-function.sh: passes shellcheck" {
  assert_shellcheck_passes "$SCRIPT"
}

@test "build-maintenance-function.sh: uses bash shebang" {
  assert_matches "$SCRIPT" '^#!/bin/bash'
}

@test "build-maintenance-function.sh: enables strict mode (set -euo pipefail)" {
  assert_contains "$SCRIPT" 'set -euo pipefail'
}

@test "build-maintenance-function.sh: references maintenance.html as input" {
  assert_contains "$SCRIPT" 'maintenance.html'
}

@test "build-maintenance-function.sh: references the template file" {
  assert_contains "$SCRIPT" 'maintenance.js.template'
}

@test "build-maintenance-function.sh: writes to maintenance.js" {
  assert_contains "$SCRIPT" 'maintenance.js'
}

@test "maintenance.js.template: exists and contains placeholder" {
  [ -f "$TEMPLATE" ]
  grep -qF '__MAINTENANCE_HTML__' "$TEMPLATE"
}

@test "maintenance.js.template: contains 503 status code and required headers" {
  grep -qF 'statusCode: 503' "$TEMPLATE"
  grep -qF 'content-type' "$TEMPLATE"
  grep -qF 'cache-control' "$TEMPLATE"
  grep -qF 'retry-after' "$TEMPLATE"
}

@test "build script: running it produces a maintenance.js without the placeholder" {
  bash "$SCRIPT"
  [ -f "$OUTPUT" ]
  if grep -qF '__MAINTENANCE_HTML__' "$OUTPUT"; then
    echo "Placeholder __MAINTENANCE_HTML__ was not replaced in $OUTPUT"
    return 1
  fi
}

@test "build script: generated maintenance.js embeds the Japanese message" {
  bash "$SCRIPT"
  grep -qF 'ただいまメンテナンス中です' "$OUTPUT"
}

@test "build script: generated maintenance.js embeds the English message" {
  bash "$SCRIPT"
  grep -qF 'Currently under maintenance' "$OUTPUT"
}

@test "build script: embedded HTML escapes JavaScript-breaking characters" {
  # 生成された maintenance.js が Node.js でパース可能であることを確認することで
  # バックスラッシュ・シングルクォート等のエスケープが適切に行われていることを検証
  bash "$SCRIPT"
  node --check "$OUTPUT"
}

@test "build script: generated maintenance.js stays under 10KB (CloudFront Function limit)" {
  bash "$SCRIPT"
  size=$(wc -c < "$OUTPUT")
  [ "$size" -lt 10240 ] || {
    echo "$OUTPUT is $size bytes; must be < 10240 bytes"
    return 1
  }
}

@test "build script: is idempotent (running twice yields the same output)" {
  bash "$SCRIPT"
  hash1=$(shasum "$OUTPUT" | awk '{print $1}')
  bash "$SCRIPT"
  hash2=$(shasum "$OUTPUT" | awk '{print $1}')
  [ "$hash1" = "$hash2" ]
}
