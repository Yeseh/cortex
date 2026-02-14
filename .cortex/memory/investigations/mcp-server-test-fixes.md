---
created_at: 2026-02-14T20:51:38.142Z
updated_at: 2026-02-14T20:55:58.888Z
tags:
  - investigation
  - mcp-server
  - tests
  - refactor
source: mcp
---
# MCP Server Test Fixes - COMPLETED ✅

## Final Status
**All 266 MCP server tests passing!** (Previously 248/265, now 266/266)

## Last Two Test Failures Fixed

**File**: `packages/server/src/memory/tools/get-recent-memories.spec.ts`

### Problem
Tests were failing with incorrect sort order:
- Expected `project/memory-0` but got `project/memory-4`
- Expected `project/active` but got `project/expired`

### Root Cause
The `createMemoryFile` test helper wasn't passing timestamps to `createMemory()`. All memories were created with `new Date()`, resulting in nearly identical timestamps and unpredictable sort order.

### Solution
Updated `test-utils.ts:createMemoryFile()` to pass `contents.metadata?.createdAt` as the `now` parameter to `createMemory()`:

```typescript
const result = await createMemory(
    adapter,
    slugPath,
    {
        content: contents.content!,
        tags: contents.metadata?.tags ?? [],
        source: contents.metadata?.source ?? 'test',
        citations: contents.metadata?.citations ?? [],
        expiresAt: contents.metadata?.expiresAt,
    },
    contents.metadata?.createdAt // ← Added this line
);
```

## Complete Fix History

### Session 1: Initial Fixes (236 → 248 passing)
1. Fixed `CategoryPath` imports in `categories.ts`
2. Updated MCP resources to use `CategoryPath` objects
3. Fixed test helpers to use `createMemory` operation
4. Fixed test directory path mismatches

### Session 2: Final Fixes (248 → 266 passing)
5. Fixed timestamp handling in test helper ✅

## Files Modified
1. `packages/storage-fs/src/categories.ts`
2. `packages/server/src/memory/resources.ts`
3. `packages/server/src/memory/tools/test-utils.ts` ← Final fix
4. `packages/server/src/memory/resources.spec.ts`

## Next Steps
Core and storage-fs tests still have failures from incomplete refactoring. These need to be fixed before the refactor branch is ready for merge.