#!/usr/bin/env bats
#
# Issue#117: scripts/maintenance.html の必須要素を検証する。
# このファイルはメンテナンス画面の HTML ソースで、build-maintenance-function.sh
# が CloudFront Function コードに埋め込む。
#
# Source of truth: documents/04_Issues/Issue#117.md §3.1, §4.3

load helpers

HTML="$REPO_ROOT/scripts/maintenance.html"

@test "maintenance.html: file exists" {
  [ -f "$HTML" ]
}

@test "maintenance.html: declares HTML5 doctype" {
  assert_matches "$HTML" '<!DOCTYPE html>'
}

@test "maintenance.html: html lang attribute is ja" {
  assert_matches "$HTML" '<html[^>]*lang="ja"'
}

@test "maintenance.html: declares UTF-8 charset" {
  assert_contains "$HTML" 'charset="UTF-8"'
}

@test "maintenance.html: declares responsive viewport" {
  assert_contains "$HTML" 'name="viewport"'
  assert_contains "$HTML" 'width=device-width'
}

@test "maintenance.html: title mentions maintenance and Photlas" {
  assert_matches "$HTML" '<title>[^<]*メンテナンス[^<]*Photlas[^<]*</title>'
}

@test "maintenance.html: contains Japanese maintenance message" {
  assert_contains "$HTML" 'ただいまメンテナンス中です'
  assert_contains "$HTML" 'しばらくお待ちください'
}

@test "maintenance.html: contains English maintenance message" {
  assert_contains "$HTML" 'Currently under maintenance'
  assert_contains "$HTML" 'Please try again later'
}

@test "maintenance.html: embeds inline SVG logo (map pin path)" {
  assert_matches "$HTML" '<svg'
  # SplashScreen.tsx の map pin path と同じものが含まれる
  assert_contains "$HTML" 'M256 80C180 80 120 140 120 216'
}

@test "maintenance.html: uses black background to match SplashScreen" {
  # #000 もしくは #000000 を許容
  assert_matches "$HTML" 'background:[[:space:]]*#000([[:space:]]|;|$)|background:[[:space:]]*#000000'
}

@test "maintenance.html: does not load external resources (no http/https URLs in src/href)" {
  # 外部 CSS / JS / 画像を読み込まないことを確認（CloudFront Function の制約上、
  # HTML 単体で完結する必要がある）
  if grep -E 'src="https?://|href="https?://' "$HTML" > /dev/null; then
    echo "External resource reference found in $HTML"
    return 1
  fi
}

@test "maintenance.html: stays well under CloudFront Function size budget (< 8KB)" {
  # CloudFront Function コード全体が 10KB 以下なので、HTML 単体は 8KB 以下に抑える
  size=$(wc -c < "$HTML")
  [ "$size" -lt 8192 ] || {
    echo "maintenance.html is $size bytes; should be < 8192 bytes"
    return 1
  }
}
