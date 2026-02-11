---
created_at: 2026-02-11T20:20:41.474Z
updated_at: 2026-02-11T20:20:41.474Z
tags:
  - decision
  - index
  - migration
  - backwards-compatibility
source: mcp
---
When adding new fields to index types (e.g., `IndexMemoryEntry`), use a graceful migration strategy:

- Make new fields optional in the type definition
- Handle null/missing values gracefully at runtime (e.g., sort entries without the field last)
- Let `reindex` naturally populate the field from source data (memory file frontmatter)
- No explicit migration tooling needed — stale indexes self-heal on reindex

Applied first for adding `updatedAt` to `IndexMemoryEntry` (issue #18).