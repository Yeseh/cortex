---
created_at: 2026-02-11T20:27:00.920Z
updated_at: 2026-02-13T18:54:56.150Z
tags:
  - todo
  - completed
  - prune
  - reindex
  - pr-19
source: mcp
---
COMPLETED — PR #19 (fix/prune-reindex-consistency branch)

Fixed `reindexCategoryIndexes()` in storage-fs to clean up stale index files for categories that no longer contain memories. Also refactored CLI prune command to delegate to core `pruneExpiredMemories()` instead of reimplementing ~200 lines of prune logic.

Known follow-up: empty parent directories are not cleaned up after stale index removal.