#!/usr/bin/env bash
# Temp-isolated acceptance test for the current Cortex CLI.
#
# Runs a focused end-to-end smoke flow against the current CLI interface,
# using a temporary config root and temporary HOME so real user config is
# never touched.
#
# Usage:
#   ./scripts/acceptance-test.sh [--keep-store]
#
# Options:
#   --keep-store    Keep temporary files for debugging.

set -euo pipefail

KEEP_STORE=false

for arg in "$@"; do
    case "$arg" in
        --keep-store) KEEP_STORE=true ;;
        *) echo "[ERROR] Unknown argument: $arg" >&2; exit 1 ;;
    esac
done

# ── Output helpers ────────────────────────────────────────────────────────────

info()  { echo "[INFO] $*"; }
pass()  { echo "[PASS] $*"; }
fail()  { echo "[FAIL] $*" >&2; }

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="$3"

    if [[ "$haystack" == *"$needle"* ]]; then
        pass "$message"
    else
        fail "$message (missing '$needle')"
        exit 1
    fi
}

# ── Cortex runner ─────────────────────────────────────────────────────────────

# run_cortex <allow_failure:0|1> [args...]
# Runs the CLI via `bun run` from $WORK_DIR.
# Returns output in CORTEX_OUTPUT and exit code in CORTEX_EXIT.
run_cortex() {
    local allow_failure="$1"
    shift

    CORTEX_OUTPUT=""
    CORTEX_EXIT=0

    CORTEX_OUTPUT=$(cd "$WORK_DIR" && bun run "$CLI_PATH" "$@" 2>&1) || CORTEX_EXIT=$?

    if [[ "$allow_failure" -eq 0 && "$CORTEX_EXIT" -ne 0 ]]; then
        echo "$CORTEX_OUTPUT"
        echo "[ERROR] Command failed (exit $CORTEX_EXIT): bun run $CLI_PATH $*" >&2
        exit 1
    fi
}

# ── Setup ─────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI_PATH="$REPO_ROOT/packages/cli/src/run.ts"

if [[ ! -f "$CLI_PATH" ]]; then
    echo "[ERROR] CLI entrypoint not found at $CLI_PATH" >&2
    exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TEMP_ROOT="$(mktemp -d -t "cortex-acceptance-${TIMESTAMP}.XXXXXX")"
WORK_DIR="$TEMP_ROOT/workdir"
HOME_DIR="$TEMP_ROOT/home"
CONFIG_DIR="$HOME_DIR/.config/cortex"

mkdir -p "$WORK_DIR" "$HOME_DIR"

info "Temp root:  $TEMP_ROOT"
info "Config dir: $CONFIG_DIR"
info "Work dir:   $WORK_DIR"

# Save originals
_OLD_HOME="${HOME:-}"
_OLD_CORTEX_CONFIG_DIR="${CORTEX_CONFIG_DIR:-}"
_OLD_CORTEX_CONFIG_CWD="${CORTEX_CONFIG_CWD:-}"

export HOME="$HOME_DIR"
export CORTEX_CONFIG_DIR="$CONFIG_DIR"
export CORTEX_CONFIG_CWD="$WORK_DIR"

# ── Cleanup trap ──────────────────────────────────────────────────────────────

cleanup() {
    export HOME="$_OLD_HOME"
    export CORTEX_CONFIG_DIR="$_OLD_CORTEX_CONFIG_DIR"
    export CORTEX_CONFIG_CWD="$_OLD_CORTEX_CONFIG_CWD"

    if [[ "$KEEP_STORE" == "true" ]]; then
        info "Kept temp root for inspection: $TEMP_ROOT"
    elif [[ -d "$TEMP_ROOT" ]]; then
        rm -rf "$TEMP_ROOT"
        info "Cleaned temp root: $TEMP_ROOT"
    fi
}

trap cleanup EXIT

# ── Tests ─────────────────────────────────────────────────────────────────────

# init
run_cortex 0 init --format json
assert_contains "$CORTEX_OUTPUT" '"kind": "init"' "init returns structured output"

if [[ -f "$CONFIG_DIR/config.yaml" ]]; then
    pass "config.yaml created in isolated config root"
else
    echo "[ERROR] Expected config file at $CONFIG_DIR/config.yaml" >&2
    exit 1
fi

# category create (prerequisite before memory add)
run_cortex 0 category --store global create standards --format json
assert_contains "$CORTEX_OUTPUT" "standards" "category create succeeds"

# memory add
run_cortex 0 memory --store global add standards/cli-smoke -c "temp test memory" --format json
assert_contains "$CORTEX_OUTPUT" "standards/cli-smoke" "memory add succeeds"

# memory show
run_cortex 0 memory --store global show standards/cli-smoke --format json
assert_contains "$CORTEX_OUTPUT" "temp test memory" "memory show returns created content"

# memory update
run_cortex 0 memory --store global update standards/cli-smoke -c "updated content" --format json
assert_contains "$CORTEX_OUTPUT" "standards/cli-smoke" "memory update succeeds"

# memory list
run_cortex 0 memory --store global list standards --format json
assert_contains "$CORTEX_OUTPUT" "cli-smoke" "memory list shows created memory"

# memory move
run_cortex 0 memory --store global move standards/cli-smoke standards/cli-smoke-moved --format json
assert_contains "$CORTEX_OUTPUT" "cli-smoke-moved" "memory move succeeds"

# memory show after move
run_cortex 0 memory --store global show standards/cli-smoke-moved --format json
assert_contains "$CORTEX_OUTPUT" "updated content" "moved memory retains updated content"

# memory remove
run_cortex 0 memory --store global remove standards/cli-smoke-moved --format json
assert_contains "$CORTEX_OUTPUT" "standards/cli-smoke-moved" "memory remove succeeds"

# store list
run_cortex 0 store list --format json
pass "store list succeeds"

# store reindex
run_cortex 0 store --store global reindex
pass "store reindex succeeds"

# store prune
run_cortex 0 store --store global prune
pass "store prune succeeds"

echo ""
echo "ALL ACCEPTANCE CHECKS PASSED"
