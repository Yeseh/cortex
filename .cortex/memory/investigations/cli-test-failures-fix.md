---
created_at: 2026-02-14T20:37:22.052Z
updated_at: 2026-02-14T21:20:49.257Z
tags:
  - bugfix
  - refactor-cleanup
  - cli
  - content-loss
  - stdin-handling
source: mcp
expires_at: 2026-03-16T23:59:59.000Z
---
# CLI Test Failures Fix (Post-Refactor)

## Context
Fixed 15 failing CLI tests after a major refactor. All 180 tests now pass.

## Critical Bugs Found

### 1. Memory Content Loss on Update (Tag-only updates)
**File**: `packages/cli/src/commands/memory/update.ts`

**Symptom**: When running `cortex memory update path --tags new-tag` (without --content), the memory content was being deleted.

**Root Cause**: 
- `resolveContent()` had `requireStdinFlag: false`
- This caused `resolveMemoryContentInput()` to read from stdin even when no content flags were provided
- In subprocess test environment, stdin returned empty string `""`
- Empty string passed to `buildUpdates()` → `updates.content = ""` (not undefined)
- Core update logic: `updates.content ?? existing.content` → empty string wins, content lost

**Fix**:
```typescript
// Early return when no content flags provided
if (options.content === undefined && options.file === undefined) {
    return { content: null };
}
// Changed requireStdinFlag to true
requireStdinFlag: true
```

### 2. Missing normalizeSlugPath Function
**File**: `packages/storage-fs/src/indexes.ts:546`

**Symptom**: `store prune` and `store reindex` commands crashed with "normalizeSlugPath is not defined"

**Root Cause**: Old code calling `normalizeSlugPath()` which was removed during refactor. Should use `MemoryPath.fromString()` instead.

**Fix**:
```typescript
// Changed import
import { type Memory, MemoryPath } from '@yeseh/cortex-core/memory';

// Replaced normalizeSlugPath call
const memoryPathResult = MemoryPath.fromString(rawSlugPath);
if (!memoryPathResult.ok()) {
    return ok({ skipped: true, reason: `...` });
}
const normalizedPath = memoryPathResult.value.toString();
```

## Files Changed
1. `packages/cli/src/commands/memory/update.ts` - stdin handling fix
2. `packages/storage-fs/src/indexes.ts` - use MemoryPath instead of normalizeSlugPath

## Test Results
- Before: 165 pass / 15 fail
- After: 180 pass / 0 fail ✅

## Lessons
1. **Stdin behavior in subprocesses**: `requireStdinFlag: false` is dangerous - it reads stdin even when not requested, returning empty strings in test environments
2. **Empty string vs undefined**: The `??` operator treats empty string as truthy, causing silent data loss
3. **Type imports**: Using `import type` prevents using the value - need regular import for `MemoryPath.fromString()`