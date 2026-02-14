---
created_at: 2026-02-14T13:49:31.563Z
updated_at: 2026-02-14T13:49:31.563Z
tags:
  - refactor
  - todo
  - incomplete
  - update
  - category
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/memory/operations/update.ts
  - packages/core/src/category/category-path.ts
---
# Incomplete Refactoring Notes

Track files that need to be updated to match the new patterns.

## update.ts - Still Uses Old Pattern

**File:** `packages/core/src/memory/operations/update.ts`

Issues:
1. Still imports from `@/memory/types.ts` (deleted file)
2. Still imports from `@/memory/validation.ts` (deleted file)
3. Still accepts `MemorySerializer` parameter
4. Uses `validateMemorySlugPath` instead of `MemoryPath.fromPath`
5. Uses `err(memoryError(...))` instead of just `memoryError(...)`
6. Uses `result.ok` property check instead of `result.ok()` method

Fix: Refactor to match `create.ts` and `get.ts` patterns.

## CategoryPath - Uses MemoryError

**File:** `packages/core/src/category/category-path.ts`

Issues:
1. Returns `Result<CategoryPath, MemoryError>` - should have own error type
2. Uses `memoryError` helper from memory module
3. Category module should have its own `CategoryError` type

Fix: Create `packages/core/src/category/result.ts` with:
- `CategoryError` type
- `CategoryErrorCode` union
- `categoryError()` factory function
- `CategoryResult<T>` type alias

## Other Files to Check

- `move.ts`, `remove.ts`, `list.ts`, `prune.ts`, `recent.ts` - verify they use new patterns
- Storage adapter implementations in `storage-fs` - need to return domain objects