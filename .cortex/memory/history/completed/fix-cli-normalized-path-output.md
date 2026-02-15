---
created_at: 2026-02-15T12:46:28.783Z
updated_at: 2026-02-15T12:46:28.783Z
tags:
  - bug-fix
  - cli
  - completed
  - path-normalization
source: mcp
citations:
  - https://github.com/Yeseh/cortex/pull/29
  - .context/plans/2026-02-15-normalize-path-output.md
---
# Fix CLI Normalized Path Output - COMPLETED

## Status: COMPLETED

## PR
https://github.com/Yeseh/cortex/pull/29

## Problem
CLI commands displayed raw user-provided paths in output instead of the normalized paths that were actually stored. For example, `test//double-slash` was shown as-is instead of the normalized `test/double-slash`.

## Solution
1. Changed `createMemory` to return `MemoryResult<Memory>` instead of `void`
2. Updated CLI commands to use normalized paths in output:
   - `add.ts`: Uses `memory.path.toString()` from returned Memory
   - `update.ts`: Uses `memory.path.toString()` from returned Memory
   - `move.ts`: Normalizes paths via `MemoryPath.fromString()` (since moveMemory returns void)
   - `remove.ts`: Normalizes path via `MemoryPath.fromString()` (since removeMemory returns void)

## Files Changed
- `packages/core/src/memory/operations/create.ts` - Return Memory instead of void
- `packages/core/src/memory/operations/create.spec.ts` - Added 2 test cases
- `packages/cli/src/commands/memory/add.ts`
- `packages/cli/src/commands/memory/update.ts`
- `packages/cli/src/commands/memory/move.ts`
- `packages/cli/src/commands/memory/remove.ts`

## Verification
- 726 tests passing
- Code review completed

## Design Note
This change improves the core API - `createMemory` returning the created Memory object is more useful than returning void. The pattern matches `updateMemory` which already returned Memory.