---
created_at: 2026-02-13T18:55:02.134Z
updated_at: 2026-02-13T18:55:02.134Z
tags:
  - decision
  - reindex
  - stale-cleanup
  - algorithm
source: mcp
---
Reindex uses a collect-then-diff approach for stale index file cleanup:

1. Collect all existing `index.yaml` file paths via `collectIndexFiles()` BEFORE rebuild
2. Build fresh index state from memory files on disk  
3. Compute set of paths the new state will write
4. Write new index files via `rebuildIndexFiles()`
5. Delete stale files: existing paths not in new set via `removeStaleIndexFiles()`

Key safety decisions:
- `resolveStoragePath` errors cause fail-fast (not silent skip) to prevent accidental data loss
- ENOENT errors during `unlink` are swallowed (race condition tolerance)
- Non-ENOENT errors during `unlink` return `IO_WRITE_ERROR`

Files: `packages/storage-fs/src/indexes.ts` (collectIndexFiles, removeStaleIndexFiles, reindexCategoryIndexes)