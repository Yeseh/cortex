---
created_at: 2026-02-13T20:31:48.371Z
updated_at: 2026-02-13T21:47:02.743Z
tags:
  - todo
  - refactor
  - index-storage
  - category-storage
  - architecture
  - prerequisite
  - openspec
source: mcp
citations:
  - .context/2026-02-13-sqlite-index-brainstorm.md
---
## Refactor: Move Index Parsing Into Storage Adapters

**Priority:** High — prerequisite for SQLite index layer, but valuable independently
**Context:** SQLite index brainstorm (2026-02-13)
**OpenSpec proposal:** `refactor-index-storage` (validated)

### What
- Change `IndexStorage.read()` to return `CategoryIndex | null` instead of raw strings
- Change `IndexStorage.write()` to accept `CategoryIndex` instead of raw strings
- Move `parseIndex()` / `serializeIndex()` from core's `serialization.ts` into `storage-fs` as internal implementation details
- Remove the `readCategoryIndex` helper in `operations.ts` that currently does `indexes.read()` → `parseIndex()`

### Also: Merge CategoryStorage index methods into IndexStorage
- `CategoryStorage.readCategoryIndex()` and `CategoryStorage.writeCategoryIndex()` overlap with `IndexStorage`
- These should live in `IndexStorage` since index management is its responsibility
- `CategoryStorage` keeps: `exists`, `ensure`, `delete`, `updateSubcategoryDescription`, `removeSubcategoryEntry`

### Also: Rename CategoryStorage methods to remove 'directory' leakage
- `categoryExists` → `exists`
- `ensureCategoryDirectory` → `ensure`
- `deleteCategoryDirectory` → `delete`