---
created_at: 2026-02-14T21:33:15.502Z
updated_at: 2026-02-14T21:58:09.448Z
tags:
  - bug
  - cli
  - completed
  - store-management
source: mcp
citations:
  - runbooks/execution/cli-runbook-2026-02-14
---
# Fix Store Init Index Creation - COMPLETED

## Problem (FIXED)
The `cortex store init` command was failing with "Failed to write root index" error.

## Root Cause
`initializeStore` was passing plain strings (`''` and `category`) to `IndexStorage.write()` which expects `CategoryPath` objects. The implementation called `.isRoot` on a string causing a runtime error.

## Solution
- Use `CategoryPath.root()` for root index
- Use `CategoryPath.fromString(category)` with proper error handling for category indexes
- Fix `buildEmptyIndex()` to properly create `CategoryPath` objects
- Replace `.unwrap()` calls with proper Result error handling

## Pull Request
https://github.com/Yeseh/cortex/pull/25

## Status: COMPLETED
- Implementation: Done
- Tests: 9 new tests added, all 735 tests passing
- Code review: Completed with findings addressed
- Documentation: Added
- PR created: #25