---
created_at: 2026-02-15T11:49:05.254Z
updated_at: 2026-02-15T11:49:05.254Z
tags:
  - decision
  - store
  - bug-fix
  - categorypath
source: mcp
---
# Decision: Store Init Index Creation Fix

## Date
2026-02-15 (fix applied in commit 0622059)

## Status
Resolved

## Problem
The `store init` command failed with "Failed to write root index" error when initializing new stores.

## Root Cause
The `initializeStore` operation in `packages/core/src/store/operations/initialize.ts` was calling `adapter.indexes.write()` with raw strings instead of `CategoryPath` objects:

```typescript
// Before (broken):
const rootIndexResult = await adapter.indexes.write('', rootIndex);
const writeResult = await adapter.indexes.write(category, categoryIndex);
```

The `IndexStorage.write()` method expects `CategoryPath` objects, which have an `.isRoot` property. When a plain string was passed, calling `.isRoot` would return `undefined`, causing incorrect behavior.

## Solution
Changed to use proper `CategoryPath` objects:

```typescript
// After (fixed):
const rootIndexResult = await adapter.indexes.write(CategoryPath.root(), rootIndex);

const catPathResult = CategoryPath.fromString(category);
if (!catPathResult.ok()) { /* error handling */ }
const writeResult = await adapter.indexes.write(catPathResult.value, categoryIndex);
```

## Files Changed
- `packages/core/src/store/operations/initialize.ts`

## Verification
- 724 tests passing
- Manual test confirms `store init --name test-store` creates proper `index.yaml`
- Store directory structure:
  ```
  .cortex/
  └── index.yaml   # Contains: memories: []\nsubcategories: []
  ```

## Related
- Commit: 0622059 (fix(core,storage-fs,cli): resolve build errors from type refactoring)
- Part of the "Big Kahuna refactor" (#24) type system changes