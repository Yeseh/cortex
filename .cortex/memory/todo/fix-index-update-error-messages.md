---
created_at: 2026-02-14T21:33:24.975Z
updated_at: 2026-02-14T21:33:24.975Z
tags:
  - bug
  - cli
  - medium-priority
  - error-handling
source: mcp
citations:
  - runbooks/execution/cli-runbook-2026-02-14
---
# Fix Misleading Index Update Error Messages

## Problem
CLI operations succeed but display "Failed to update indexes" error message, causing user confusion.

## Current Behavior
```bash
cortex memory add test/example -c "content" --store my-store
# Error: Failed to update indexes
# But: File is created successfully and accessible after reindex
```

## Expected Behavior
- Either: Fix the underlying index update issue
- Or: Suppress the error if operation actually succeeded
- Provide clear feedback about operation status

## Impact
- Confusing user experience
- Users may think operation failed when it succeeded
- Requires running `store reindex` to see created memories
- Low severity but affects trust in CLI

## Observations
- Memory files are created successfully
- Files contain correct content and metadata
- `store reindex` makes memories visible
- Issue appears with certain stores (working-test store in tests)

## Root Cause (Hypothesis)
Race condition or error handling issue in index update logic. Operation may be retrying or failing silently after file creation.

## Solution Approach
1. Review index update logic in storage layer
2. Add transaction-like behavior or rollback
3. Improve error handling to distinguish between partial and complete failure
4. Consider making index updates more resilient

## Test Case
- TC-CLI-026: Store Resolution (Explicit)

## Location
- `packages/core/src/index/operations.ts` (index update logic)
- `packages/cli/src/handlers/*.ts` (error handling)
- `packages/storage-fs/src/adapters/*` (index writing)