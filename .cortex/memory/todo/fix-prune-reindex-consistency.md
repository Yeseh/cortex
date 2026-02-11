---
created_at: 2026-02-11T20:27:00.920Z
updated_at: 2026-02-11T20:27:00.920Z
tags:
  - todo
  - bug
  - prune
  - reindex
  - consistency
source: mcp
---
Fix `prune` to also reindex the store after deleting expired memories. Currently pruned memories may leave stale index entries behind.

Fix `reindex` to delete index entries for memories whose files no longer exist on disk. Currently orphaned entries persist until manual cleanup.