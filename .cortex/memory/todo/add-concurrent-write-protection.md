---
created_at: 2026-02-14T21:33:43.075Z
updated_at: 2026-02-14T21:33:43.075Z
tags:
  - enhancement
  - medium-priority
  - concurrency
  - reliability
source: mcp
citations:
  - runbooks/execution/cli-runbook-2026-02-14
---
# Add Concurrent Write Protection for Index Updates

## Problem
Concurrent CLI invocations create memory files successfully but cause index inconsistencies, requiring manual reindex.

## Current Behavior
```bash
# Running these concurrently:
cortex memory add test/concurrent1 -c "First" &
cortex memory add test/concurrent2 -c "Second" &
cortex memory add test/concurrent3 -c "Third" &
wait

# Result:
# - All three files created successfully
# - Only one appears in `cortex memory list test`
# - Running `cortex store reindex` fixes the issue
```

## Expected Behavior
All concurrent operations should:
- Create memory files ✅
- Update indexes atomically
- All memories visible in listings without reindex

## Impact
- Multi-user environments may experience index drift
- Scripted bulk operations may require periodic reindexing
- Medium severity for production use
- Data is not lost, just not indexed

## Root Cause
Index update operations are not atomic or protected from concurrent writes. Multiple processes may read-modify-write index.yaml simultaneously, causing lost updates.

## Solution Options

### Option A: File Locking (Recommended)
- Use OS-level file locking (flock, lockfile)
- Lock index.yaml during updates
- Retry on lock contention

### Option B: Atomic Index Updates
- Write to temp file, then atomic rename
- Use versioning or timestamps
- Implement optimistic concurrency control

### Option C: Index Rebuild
- Make listings resilient to stale indexes
- Scan filesystem if index seems incomplete
- Auto-trigger reindex when inconsistency detected

## Implementation Approach
1. Add file locking utility (`packages/storage-fs/src/utils/lock.ts`)
2. Wrap index update operations with locks
3. Add timeout and retry logic
4. Test with concurrent operations
5. Document concurrency behavior

## Test Case
- TC-CLI-040: Concurrent Operations

## Location
- `packages/storage-fs/src/adapters/index-storage.ts` (index update methods)
- `packages/core/src/index/operations.ts` (if locking should be at core level)