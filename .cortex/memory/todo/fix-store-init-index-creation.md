---
created_at: 2026-02-14T21:33:15.502Z
updated_at: 2026-02-14T21:33:15.502Z
tags:
  - bug
  - cli
  - high-priority
  - store-management
source: mcp
citations:
  - runbooks/execution/cli-runbook-2026-02-14
---
# Fix Store Init Index Creation

## Problem
The `cortex store init` command fails to create the root index.yaml file, making store initialization fail.

## Current Behavior
```bash
cortex store init /path/to/store -n my-store
# Error: Failed to write root index at /path/to/store
```

## Expected Behavior
```bash
cortex store init /path/to/store -n my-store
# Should create:
# - /path/to/store/index.yaml
# - Register store in registry
# - Success message
```

## Impact
- Store initialization requires manual intervention
- Poor user experience for new store setup
- Workaround: Manually create directory structure and use `store add` to register

## Observations
- Store gets registered in registry despite error
- Directory structure is created
- Only index.yaml creation fails
- Manual creation of index.yaml with "categories: []" works

## Root Cause (Hypothesis)
Path resolution or permission issue when writing root index file. May be related to cross-platform path handling.

## Solution Approach
1. Review `packages/cli/src/commands/store.ts` init handler
2. Check underlying core operation for index creation
3. Verify path resolution and file writing logic
4. Add proper error handling and logging

## Test Case
- TC-CLI-020: Store Init (New Store)

## Location
- `packages/cli/src/commands/store.ts` (init command handler)
- `packages/core/src/store/operations.ts` or similar (core init logic)