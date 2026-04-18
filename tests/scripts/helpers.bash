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
