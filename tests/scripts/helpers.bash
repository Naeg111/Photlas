# Shared helpers for bats tests on WAF setup scripts.
# Loaded via `load helpers` from each .bats file.

# Resolve the repo root relative to this file (tests/scripts/helpers.bash).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"

# Assert that a script file exists and is executable.
assert_script_executable() {
  local script_path="$1"
  [ -f "$script_path" ] || {
    echo "Script not found: $script_path"
    return 1
  }
  [ -x "$script_path" ] || {
    echo "Script not executable: $script_path"
    return 1
  }
}

# Assert that shellcheck passes on the given script.
assert_shellcheck_passes() {
  local script_path="$1"
  shellcheck "$script_path"
}

# Assert that a script contains a given substring (for declarative
# verification that required AWS CLI calls / config values are present).
assert_contains() {
  local script_path="$1"
  local needle="$2"
  grep -qF -- "$needle" "$script_path" || {
    echo "Expected '$needle' in $script_path but not found."
    return 1
  }
}

# Assert that a script matches a given regex.
assert_matches() {
  local script_path="$1"
  local pattern="$2"
  grep -qE -- "$pattern" "$script_path" || {
    echo "Expected regex '$pattern' to match in $script_path but did not."
    return 1
  }
}

# ---- AWS CLI / network mocking ----
#
# テスト中はネットワークに出ないよう、PATH 先頭に偽の aws/curl/sleep を
# 配置して呼び出しを記録する。各テストの先頭で setup_aws_mock を呼び、
# trap teardown_aws_mock EXIT でクリーンアップする運用。
setup_aws_mock() {
  AWS_MOCK_DIR="$(mktemp -d)"
  AWS_MOCK_LOG="$AWS_MOCK_DIR/calls.log"
  : > "$AWS_MOCK_LOG"
  cat > "$AWS_MOCK_DIR/aws" <<'AWS_MOCK_EOF'
#!/bin/bash
# 引数を1行で記録（先頭はサブコマンド）
echo "$*" >> "$AWS_MOCK_LOG"
case "$1" in
  sts)
    case "$2" in
      get-caller-identity) echo "123456789012" ;;
      *) echo "{}" ;;
    esac
    ;;
  cloudfront)
    case "$2" in
      describe-function|describe-distribution)
        # --query/--output text の場合に ETag っぽい固定値を返す
        echo "TESTETAG"
        ;;
      list-functions)
        echo '{"FunctionList":{"Items":[]}}'
        ;;
      *)
        echo "{}"
        ;;
    esac
    ;;
  elbv2)
    case "$2" in
      describe-rules)
        echo '{"Rules":[{"RuleArn":"arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:listener-rule/test/abc","Priority":"50"}]}'
        ;;
      describe-listeners)
        echo '{"Listeners":[{"ListenerArn":"arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:listener/app/photlas-alb/abc/def"}]}'
        ;;
      describe-load-balancers)
        echo '{"LoadBalancers":[{"LoadBalancerArn":"arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:loadbalancer/app/photlas-alb/abc"}]}'
        ;;
      *)
        echo "{}"
        ;;
    esac
    ;;
  *)
    echo "{}"
    ;;
esac
exit 0
AWS_MOCK_EOF
  chmod +x "$AWS_MOCK_DIR/aws"

  # curl をモック (確認ステップでネットワークに出ない)
  cat > "$AWS_MOCK_DIR/curl" <<'CURL_MOCK_EOF'
#!/bin/bash
echo "HTTP/1.1 503 Service Unavailable"
echo "content-type: text/html; charset=utf-8"
exit 0
CURL_MOCK_EOF
  chmod +x "$AWS_MOCK_DIR/curl"

  # sleep を即時終了モック (テスト高速化)
  cat > "$AWS_MOCK_DIR/sleep" <<'SLEEP_MOCK_EOF'
#!/bin/bash
exit 0
SLEEP_MOCK_EOF
  chmod +x "$AWS_MOCK_DIR/sleep"

  export PATH="$AWS_MOCK_DIR:$PATH"
  export AWS_MOCK_LOG
}

teardown_aws_mock() {
  if [ -n "${AWS_MOCK_DIR:-}" ] && [ -d "$AWS_MOCK_DIR" ]; then
    rm -rf "$AWS_MOCK_DIR"
  fi
}

# Returns line number of the first AWS call matching the regex, or empty.
aws_mock_line_of_first_match() {
  local pattern="$1"
  awk -v p="$pattern" '$0 ~ p {print NR; exit}' "$AWS_MOCK_LOG"
}

# Asserts that pattern A appears before pattern B in the AWS mock log.
assert_aws_call_order() {
  local pattern_a="$1"
  local pattern_b="$2"
  local line_a line_b
  line_a=$(aws_mock_line_of_first_match "$pattern_a")
  line_b=$(aws_mock_line_of_first_match "$pattern_b")
  if [ -z "$line_a" ]; then
    echo "Pattern A not found: $pattern_a" >&2
    cat "$AWS_MOCK_LOG" >&2
    return 1
  fi
  if [ -z "$line_b" ]; then
    echo "Pattern B not found: $pattern_b" >&2
    cat "$AWS_MOCK_LOG" >&2
    return 1
  fi
  if [ "$line_a" -ge "$line_b" ]; then
    echo "Expected $pattern_a (line $line_a) to come before $pattern_b (line $line_b)" >&2
    cat "$AWS_MOCK_LOG" >&2
    return 1
  fi
}
