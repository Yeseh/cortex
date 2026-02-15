---
created_at: 2026-02-14T21:33:24.975Z
updated_at: 2026-02-15T11:31:03.734Z
tags:
  - bug
  - cli
  - completed
  - error-handling
source: mcp
expires_at: 2026-03-31T23:59:59.000Z
citations:
  - runbooks/execution/cli-runbook-2026-02-14
---
# Fix Misleading Index Update Error Messages - COMPLETED

## Status: COMPLETED

## Problem (FIXED)
CLI operations succeeded but displayed "Failed to update indexes" error message, causing user confusion.

## Solution
Improved error messages in `createMemory`, `updateMemory`, and `moveMemory` operations to include:
1. Memory path context
2. Underlying error reason from storage layer
3. Remediation suggestion: "Run cortex store reindex to rebuild indexes"
4. Clarity about partial success states

## Example Before
```
Error: Failed to update indexes
```

## Example After
```
Memory written but index update failed for "project/test/memory": Index error. Run "cortex store reindex" to rebuild indexes.
```

## Pull Request
https://github.com/Yeseh/cortex/pull/27

## Files Changed
- `packages/core/src/memory/operations/create.ts`
- `packages/core/src/memory/operations/update.ts`
- `packages/core/src/memory/operations/move.ts`
- Tests added/updated in corresponding `.spec.ts` files

## Verification
- 724 tests passing
- Code review completed
- ESLint passes