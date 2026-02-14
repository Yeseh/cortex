---
created_at: 2026-02-14T21:00:45.577Z
updated_at: 2026-02-14T21:00:45.577Z
tags:
  - refactor
  - tests
  - bugfix
  - completed
source: mcp
---
# Refactor Test Fixes - ALL TESTS PASSING ✅

## Final Results
**725 tests passing across all packages!** (0 failures)

## Test Breakdown
- CLI: 180/180 ✅
- MCP Server: 266/266 ✅  
- Core: ✅
- Storage-FS: ✅

## Fixes Applied

### 1. tokens.spec.ts (3 fixes)
**Issue**: Using `result.ok` property instead of `result.ok()` method
**Fix**: Changed to method calls on lines 59, 79, 89

### 2. utils.spec.ts 
**Issue**: Importing `ok` and `err` from utils.ts (don't exist), and testing them
**Fix**: Removed import and deleted tests for `ok`/`err` (those are core utilities, not storage-fs)

### 3. filesystem-registry.spec.ts
**Issue**: Test calling `memories.write()` with raw string instead of Memory object
**Fix**: Updated test to create proper Memory domain object using `Memory.init()`

### 4. indexes.spec.ts (4 fixes + 1 bug fix)
**Issue**: `updateCategoryIndexes()` called with string paths instead of MemoryPath objects
**Fix**: 
- Added `memoryPath()` helper function
- Updated all test calls to use `memoryPath('project/test-memory')`

**CRITICAL BUG FOUND**: `upsertMemoryEntry` was comparing MemoryPath objects by reference (`!==`) instead of by value
**Fix**: Changed line 216 from:
```typescript
const memories = currentIndex.memories.filter((existing) => existing.path !== entry.path);
```
To:
```typescript
const memories = currentIndex.memories.filter((existing) => existing.path.toString() !== entry.path.toString());
```
This bug was causing duplicate index entries on updates.

### 5. index.spec.ts (DELETED)
**Issue**: Tests calling deprecated `adapter.writeMemoryFile()`, `adapter.readIndexFile()` APIs that no longer exist
**Decision**: Deleted file - these were low-level implementation tests for APIs that were removed during refactor

### 6. operations.spec.ts (DELETED)
**Issue**: Tests for `initializeStore()` function that no longer exists
**Decision**: Deleted file - functionality was deprecated

### 7. server/tools/test-utils.ts (MCP server fix from previous session)
**Issue**: `createMemoryFile()` not passing timestamps to `createMemory()`
**Fix**: Added `contents.metadata?.createdAt` as the `now` parameter

## Files Modified
1. `packages/core/src/tokens.spec.ts` - result.ok() method calls
2. `packages/storage-fs/src/utils.spec.ts` - removed invalid imports/tests
3. `packages/storage-fs/src/filesystem-registry.spec.ts` - Memory object creation
4. `packages/storage-fs/src/indexes.spec.ts` - MemoryPath helpers
5. `packages/storage-fs/src/indexes.ts` - **BUG FIX: upsertMemoryEntry deduplication**
6. `packages/server/src/memory/tools/test-utils.ts` - timestamp passing

## Files Deleted
1. `packages/storage-fs/src/index.spec.ts` - obsolete low-level adapter tests
2. `packages/storage-fs/src/operations.spec.ts` - tests for deleted functionality

## Key Lessons
1. **Domain objects vs strings**: After refactor, storage layer works with domain objects (Memory, MemoryPath), not raw strings
2. **Value vs reference comparison**: Always compare domain objects by `.toString()`, not by reference
3. **Test isolation**: Tests using domain objects need proper factory helpers
4. **Deprecated tests**: Delete tests for removed functionality rather than trying to fix them