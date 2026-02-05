---
created_at: 2026-02-05T20:31:20.313Z
updated_at: 2026-02-05T20:31:20.313Z
tags:
  - architecture
  - categories
  - storage
  - index
source: mcp
---
# Category Description Storage Location

Category descriptions are stored in the **parent category's index file**, not the category's own index.

## Storage Pattern

| Category Type | Description Location |
|---------------|---------------------|
| Root category (e.g., `issues`) | `index.yaml` (store root) |
| Nested category (e.g., `standards/testing`) | `standards/index.yaml` |

## Index File Structure

```yaml
memories: []
subcategories:
  - path: decisions
    memory_count: 13
    description: Architectural decisions and design choices  # ← stored here
  - path: issues
    memory_count: 1
    description: Known issues and bugs being tracked
```

## Implementation

- `setDescription()` in `core/category/operations.ts` calls `storage.updateSubcategoryDescription(parentPath, path, description)`
- For root categories, `parentPath` is empty string (`''`)
- `updateSubcategoryDescription` in `storage-fs/categories.ts` handles empty parent by writing to store root index

## Why This Design

Parent-based storage enables:
1. Efficient category listing (descriptions available without reading each category)
2. Single file update for description changes
3. Consistent pattern for all category depths