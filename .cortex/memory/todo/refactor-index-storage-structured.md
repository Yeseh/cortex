---
created_at: 2026-02-13T20:31:48.371Z
updated_at: 2026-02-15T10:54:27.134Z
tags:
  - refactor
  - index-storage
  - completed
  - archived
source: mcp
citations:
  - .context/2026-02-13-sqlite-index-brainstorm.md
---
## Refactor: Move Index Parsing Into Storage Adapters

**Status:** ✅ COMPLETED AND ARCHIVED (2026-02-15)

**Priority:** High — prerequisite for SQLite index layer, but valuable independently
**Context:** SQLite index brainstorm (2026-02-13)
**OpenSpec proposal:** `refactor-index-storage` (archived as `2026-02-15-refactor-index-storage`)

### What Was Done
- Changed `IndexStorage.read()` to return `CategoryIndex | null` instead of raw strings
- Changed `IndexStorage.write()` to accept `CategoryIndex` instead of raw strings
- Moved `parseIndex()` / `serializeIndex()` from core's `serialization.ts` into `storage-fs` as internal implementation details
- Removed the `readCategoryIndex` helper in `operations.ts`
- Merged CategoryStorage index methods into IndexStorage
- Renamed CategoryStorage methods to remove 'directory' leakage

### PRs
- #23 - refactor index storage interfaces
- #24 - Big kahuna refactor

### Verification
- All 739 tests passing
- Specs updated: category-core, index, storage-filesystem