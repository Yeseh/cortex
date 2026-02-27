#!/usr/bin/env bash

set -euo pipefail

workspace_dir="${CORTEX_WORKSPACE_DIR:-${WORKSPACE_FOLDER:-${PWD}}}"
command_pattern="bun run packages/server/src/index.ts"
log_file="/tmp/cortex-mcp.log"

if pgrep -f "${command_pattern}" >/dev/null 2>&1; then
    exit 0
fi

cd "${workspace_dir}"
nohup bun run packages/server/src/index.ts >>"${log_file}" 2>&1 &