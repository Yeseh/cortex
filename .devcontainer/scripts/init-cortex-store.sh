#!/usr/bin/env bash

set -euo pipefail

workspace_dir="${CORTEX_WORKSPACE_DIR:-${WORKSPACE_FOLDER:-${PWD}}}"
store_name="cortex"
store_path="${workspace_dir}/.cortex/memory"

mkdir -p "${store_path}"

# Initialize global config if it does not already exist.
cortex init >/dev/null 2>&1 || true

# Ensure the target store is initialized on disk.
cortex store init "${store_path}" --name "${store_name}" >/dev/null 2>&1 || true

# Ensure registry mapping for store_name points to the current workspace path.
cortex store remove "${store_name}" >/dev/null 2>&1 || true
cortex store add "${store_name}" "${store_path}" >/dev/null