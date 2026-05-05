#!/bin/bash
# Issue#117: メンテナンス画面の HTML を CloudFront Function 用 JS に埋め込む
# ラッパースクリプト。
#
# 入力:
#   scripts/maintenance.html (画面 HTML ソース)
#   scripts/cloudfront-function/maintenance.js.template (関数コードのテンプレート)
# 出力:
#   scripts/cloudfront-function/maintenance.js (生成物。git 管理対象外)
#
# JS 文字列リテラル向けのエスケープ処理を含むため、ロジック本体は Node.js
# (cloudfront-function/build.mjs) に委譲する。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "${SCRIPT_DIR}/cloudfront-function/build.mjs"
